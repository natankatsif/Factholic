import { z } from "zod";
import type { SourceId } from "@news/contracts";
import type { Stage, StageContext } from "../../pipeline/context.ts";
import type { Claim, ClaimStructure, TimeMarker } from "../03-claim-extraction/types.ts";
import type { FoundSource } from "../04-source-search/types.ts";
import { askJson, embed, LlmConfigError } from "./llm.ts";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import {
  buildTree,
  claimText,
  copyText,
  embeddingSimilarity,
  pickForExtraction,
  shingleSimilarity,
  type CopyFacts,
  type Similarity,
} from "./tree.ts";
import { VIDEO_NODE_ID, type ProvenanceInput, type ProvenanceTree } from "./types.ts";

// ===================== LLM: СТРУКТУРА В КАЖДОЙ КОПИИ =====================

const TIME_MARKERS = [
  "just_now",
  "today",
  "yesterday",
  "this_week",
  "recently",
] as const satisfies readonly TimeMarker[];

/** ClaimStructure из 03-claim-extraction/types.ts */
const StructureSchema = z.object({
  numbers: z.array(
    z.object({ value: z.number(), unit: z.string(), approximate: z.boolean(), raw: z.string() }),
  ),
  places: z.array(z.string()),
  eventTime: z.object({ raw: z.string(), date: z.string().nullable() }).nullable(),
  timeMarkers: z.array(z.enum(TIME_MARKERS)),
  certainty: z.enum(["asserted", "hedged"]),
  attributedTo: z.string().nullable(),
});

const ExtractionSchema = z.object({
  video: StructureSchema,
  // сначала «есть ли утверждение» и «на кого ссылается», потом структура — так структура опирается на разбор
  copies: z.array(
    z.object({
      id: z.string(),
      containsClaim: z.boolean(),
      cites: z.array(z.string()),
      structure: StructureSchema.nullable(),
    }),
  ),
});

type RawStructure = z.infer<typeof StructureSchema>;

interface Extraction {
  video: ClaimStructure;
  copies: Map<SourceId, Omit<CopyFacts, "source">>;
}

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_PROVENANCE=real). Подробно — README этапа, раздел «Реализация».
 *  1. Похожесть текстов: эмбеддинги утверждения и копий одним batch-запросом; упали — шинглы (лог, без исключения).
 *  2. Структура (LLM, один вызов, effort low): есть ли утверждение в копии, его ClaimStructure, на кого ссылается.
 *     Копий больше MAX_COPIES — LLM читает самые датированные/похожие, остальные — без структуры.
 *     Сбой LLM (кроме LlmConfigError и отмены) — дерево без структур и атрибуций, с логом.
 *  3. Дерево (tree.ts): рёбра link > attribution > duplicate, один родитель, корень, видео, voteGroups.
 */
export const buildProvenanceTreeReal: Stage<ProvenanceInput, ProvenanceTree> = async (input, ctx) => {
  const { claim, video } = input;
  const copies = uniqueById(input.copies);
  if (!copies.length) {
    // не с чем сравнивать — без вызовов API
    return buildTree({
      claimId: claim.id,
      copies: [],
      video: { ...video, structure: claim.structure ?? null },
      similarity: { method: "embeddings", pairs: [], toClaim: [] },
    });
  }

  const similarity = await textSimilarity(claim, copies, ctx);
  const picked = pickForExtraction(copies, similarity.toClaim).map((i) => copies[i]);
  if (picked.length < copies.length)
    ctx.log(`05: ${claim.id}: структуру читаем в ${picked.length} из ${copies.length} копий`);
  const extraction = await extractStructures(input, picked, ctx);

  const facts = copies.map((source): CopyFacts => ({
    source,
    ...(extraction?.copies.get(source.id) ?? { structure: null, cites: [] }),
  }));
  const tree = buildTree({
    claimId: claim.id,
    copies: facts,
    video: { ...video, structure: claim.structure ?? extraction?.video ?? null },
    similarity,
  });

  const via = (v: string) => tree.nodes.filter((n) => n.id !== VIDEO_NODE_ID && n.via === v).length;
  ctx.log(`05: ${claim.id}: дерево`, {
    copies: copies.length,
    withClaim: facts.filter((f) => f.structure).length,
    similarity: similarity.method,
    edges: { link: via("link"), attribution: via("attribution"), duplicate: via("duplicate") },
    rootId: tree.rootId,
    videoParent: tree.nodes.at(-1)?.parentId ?? null,
  });
  return tree;
};

// ===================== ШАГИ =====================

/** Отмена и ошибки настройки пробрасываем; остальные сбои API этап переживает с более бедным деревом */
function isFatal(err: unknown, ctx: StageContext): boolean {
  return ctx.signal.aborted || err instanceof LlmConfigError;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function textSimilarity(claim: Claim, copies: FoundSource[], ctx: StageContext): Promise<Similarity> {
  const texts = copies.map(copyText);
  try {
    const [claimVector, ...copyVectors] = await embed([claimText(claim), ...texts], ctx);
    return embeddingSimilarity(claimVector, copyVectors);
  } catch (err) {
    if (isFatal(err, ctx)) throw err;
    ctx.log(`05: ${claim.id}: эмбеддинги недоступны — дубли ищем по шинглам`, errorMessage(err));
    return shingleSimilarity(claimText(claim), texts);
  }
}

async function extractStructures(
  input: ProvenanceInput,
  copies: FoundSource[],
  ctx: StageContext,
): Promise<Extraction | null> {
  const { claim } = input;
  try {
    const { data } = await askJson(
      {
        effort: "low",
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(claim, input.video, copies),
        schema: ExtractionSchema,
      },
      ctx,
    );
    const asked = new Set(copies.map((c) => c.id));
    const byId: Extraction["copies"] = new Map();
    for (const raw of data.copies) {
      if (!asked.has(raw.id) || byId.has(raw.id)) continue;
      if (raw.containsClaim && !raw.structure)
        ctx.log(`05: ${claim.id}: ${raw.id}: утверждение есть, но структуры нет — считаем, что нет`);
      byId.set(raw.id, {
        structure: raw.containsClaim && raw.structure ? cleanStructure(raw.structure) : null,
        cites: cleanCites(raw.cites),
      });
    }
    const missing = copies.length - byId.size;
    if (missing) ctx.log(`05: ${claim.id}: LLM пропустила ${missing} копий — они без структуры`);
    return { video: cleanStructure(data.video), copies: byId };
  } catch (err) {
    if (isFatal(err, ctx)) throw err;
    ctx.log(`05: ${claim.id}: структура не извлечена — дерево без структур и атрибуций`, errorMessage(err));
    return null;
  }
}

// ===================== ЧИСТКА ОТВЕТА LLM =====================

const PARTIAL_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

function cleanStructure(raw: RawStructure): ClaimStructure {
  const eventRaw = raw.eventTime?.raw.trim() ?? "";
  const eventDate = raw.eventTime?.date?.trim() ?? "";
  const date = PARTIAL_DATE.test(eventDate) ? eventDate : null;
  return {
    numbers: raw.numbers
      .filter((n) => Number.isFinite(n.value))
      .map((n) => ({ value: n.value, unit: n.unit.trim(), approximate: n.approximate, raw: n.raw.trim() })),
    places: unique(raw.places.map((p) => p.trim()).filter(Boolean)),
    eventTime: eventRaw || date ? { raw: eventRaw || (date ?? ""), date } : null,
    timeMarkers: unique(raw.timeMarkers),
    certainty: raw.certainty,
    attributedTo: raw.attributedTo?.trim() || null,
  };
}

/** Без пустых, дублей (без регистра) и однобуквенных — по ним атрибуция совпала бы с чем угодно */
function cleanCites(cites: string[]): string[] {
  const seen = new Set<string>();
  return cites
    .map((c) => c.trim())
    .filter((c) => {
      const key = c.toLowerCase();
      if (c.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Повтор id из 04 — одна и та же копия: оставляем первую */
function uniqueById(copies: FoundSource[]): FoundSource[] {
  const seen = new Set<SourceId>();
  return copies.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
