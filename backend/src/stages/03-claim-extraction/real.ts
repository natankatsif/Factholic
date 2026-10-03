import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import type { ClaimCategory } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import type { TranscriptSegment } from "../02-transcription/types.ts";
import { askJson, LlmConfigError } from "./llm.ts";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { findQuote, tokenize } from "./range.ts";
import type { Claim, ClaimExtractionInput, ClaimExtractionOutput, ClaimStructure } from "./types.ts";

const CATEGORIES = [
  "event",
  "statistic",
  "quote",
  "scientific",
  "historical",
  "prediction",
  "other",
] as const satisfies readonly ClaimCategory[];

const ExtractionSchema = z.object({
  claims: z.array(
    z.object({
      segmentIds: z.array(z.string()),
      quote: z.string(),
      normalized: z.string(),
      category: z.enum(CATEGORIES),
      checkworthiness: z.number(),
      entities: z.array(z.string()),
      // structured output OpenAI: все поля обязательны, «нет значения» — через null
      structure: z.object({
        event: z.string(),
        numbers: z.array(z.object({ value: z.string(), about: z.string() })),
        places: z.array(z.string()),
        time: z.object({ text: z.string(), date: z.string().nullable(), relative: z.boolean() }).nullable(),
        certainty: z.enum(["asserted", "reported", "hedged"]),
        certaintyMarkers: z.array(z.string()),
        attributedTo: z.string().nullable(),
      }),
    }),
  ),
});
type RawClaim = z.infer<typeof ExtractionSchema>["claims"][number];

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_CLAIM_EXTRACTION=real).
 * LLM выделяет тезисы из новых сегментов, код проверяет ответ, считает точный range по словам
 * и сам выдаёт id (фронт хранит факт-чеки в Map по id — совпадение затёрло бы чужой тезис).
 */
export const extractClaimsReal: Stage<ClaimExtractionInput, ClaimExtractionOutput> = async (input, ctx) => {
  if (!input.segments.length) return { claims: [] };

  let raw: RawClaim[];
  try {
    const { data } = await askJson(
      {
        // этап на критическом пути: пока он идёт, пользователь не видит даже лоадер
        effort: "low",
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        schema: ExtractionSchema,
      },
      ctx,
    );
    raw = data.claims;
  } catch (err) {
    // ошибка конфигурации (провайдер, ключ, модель) — валим job, чтобы её заметили;
    // временный сбой LLM — теряем тезисы одного куска, но видео проверяется дальше
    if (ctx.signal.aborted || isConfigError(err)) throw err;
    ctx.log("03: LLM не ответила, кусок пропущен", err);
    return { claims: [] };
  }

  const claims = toClaims(raw, input);
  ctx.log(`03: тезисов ${claims.length} (LLM предложила ${raw.length})`);
  return { claims };
};

/** 400 из-за содержимого куска (фильтр безопасности на видео о войне, слишком длинный текст) — не ошибка настройки */
const CONTENT_ERRORS = new Set(["invalid_prompt", "context_length_exceeded"]);

function isConfigError(err: unknown): boolean {
  if (err instanceof OpenAI.BadRequestError) return !CONTENT_ERRORS.has(String(err.code));
  return (
    err instanceof LlmConfigError ||
    err instanceof OpenAI.AuthenticationError ||
    err instanceof OpenAI.PermissionDeniedError ||
    err instanceof OpenAI.NotFoundError
  );
}

function toClaims(raw: RawClaim[], input: ClaimExtractionInput): Claim[] {
  const segmentsById = new Map(input.segments.map((s) => [s.id, s]));
  const seen = new Set(input.previousClaims.map((c) => dedupKey(c.normalized)));
  const claims: Claim[] = [];

  for (const r of raw) {
    const quote = r.quote.trim();
    const normalized = r.normalized.trim();
    if (!quote || !normalized) continue;

    const key = dedupKey(normalized);
    if (seen.has(key)) continue;

    const listed = r.segmentIds
      .map((id) => segmentsById.get(id))
      .filter((s): s is TranscriptSegment => s !== undefined)
      .sort((a, b) => a.start - b.start);
    const placed = placeQuote(quote, listed, input.segments);
    // цитаты нет в новом тексте (выдумана, перефразирована или взята из контекста) — не показываем:
    // пользователь должен видеть дословно сказанное и на правильном таймкоде
    if (!placed) continue;
    const { segments, range } = placed;
    // в «уже найденные» — только принятый тезис, иначе отброшенный заблокировал бы такой же с верной цитатой
    seen.add(key);

    claims.push({
      id: `clm_${randomUUID().slice(0, 8)}`,
      jobId: input.jobId,
      range,
      quote,
      normalized,
      category: r.category,
      checkworthiness: Math.min(1, Math.max(0, r.checkworthiness)),
      language: input.language,
      entities: [...new Set(r.entities.map((e) => e.trim()).filter(Boolean))],
      segmentIds: segments.map((s) => s.id),
      speaker: segments[0].speaker,
      structure: cleanStructure(r.structure),
    });
  }
  return claims;
}

/** Минимальная доля слов цитаты, которые должны найтись в речи */
const MIN_QUOTE_MATCH = 0.5;

/**
 * Где в новых сегментах звучит цитата: сначала в сегментах, которые указала LLM,
 * иначе ищем по всем новым (LLM могла ошибиться в id). Не нашли — undefined.
 */
function placeQuote(quote: string, listed: TranscriptSegment[], all: TranscriptSegment[]) {
  if (listed.length) {
    const found = findQuote(quote, listed);
    if (found.matched >= MIN_QUOTE_MATCH) return { segments: listed, range: found.range };
  }
  const sorted = [...all].sort((a, b) => a.start - b.start);
  const found = findQuote(quote, sorted);
  if (found.matched < MIN_QUOTE_MATCH) return undefined;
  const { start, end } = found.range;
  const segments = sorted.filter((s) => s.end >= start && s.start <= end);
  return segments.length ? { segments, range: found.range } : undefined;
}

function dedupKey(text: string): string {
  return tokenize(text).join(" ");
}

/** Подчистить ответ LLM: пустые строки → убрать, дату — только в формате YYYY[-MM[-DD]] */
function cleanStructure(raw: RawClaim["structure"]): ClaimStructure {
  const strings = (list: string[]) => [...new Set(list.map((x) => x.trim()).filter(Boolean))];
  const date = raw.time?.date?.trim();
  return {
    event: raw.event.trim(),
    numbers: raw.numbers
      .map((n) => ({ value: n.value.trim(), about: n.about.trim() }))
      .filter((n) => n.value),
    places: strings(raw.places),
    time: raw.time?.text.trim()
      ? {
          text: raw.time.text.trim(),
          date: date && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(date) ? date : null,
          relative: raw.time.relative,
        }
      : null,
    certainty: raw.certainty,
    certaintyMarkers: strings(raw.certaintyMarkers),
    attributedTo: raw.attributedTo?.trim() || null,
  };
}
