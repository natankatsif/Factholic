/**
 * Склеивает этапы 01 → 06 и шлёт события во фронт.
 *
 *   ingest ──chunk──▶ transcribe ──segments──▶ extractClaims ──claim──▶ (claim.detected)
 *                                                                 └──▶ searchSources ──▶ verify ──▶ (claim.checked)
 *
 * Конвейер: куски транскрибируются и разбираются на тезисы по порядку, а проверка тезисов (поиск + LLM —
 * самое долгое) идёт в фоне. Следующий кусок не ждёт, пока проверятся тезисы предыдущего.
 * Проверяются только самые важные тезисы (config.limits) — каждый стоит ~9 запросов к поиску.
 */
import type { FactCheck, JobId, ServerEvent, StartAnalysisRequest } from "@news/contracts";
import { config } from "../config.ts";
import { ingest, type LiveAudioChunk } from "../stages/01-ingest/index.ts";
import { transcribe, type TranscriptSegment } from "../stages/02-transcription/index.ts";
import { CHECKWORTHINESS_THRESHOLD, extractClaims, type Claim } from "../stages/03-claim-extraction/index.ts";
import { searchSources } from "../stages/04-source-search/index.ts";
import { verify } from "../stages/05-verification/index.ts";
import { toFactCheck } from "../stages/06-delivery/index.ts";
import type { StageContext } from "./context.ts";

const CONTEXT_WINDOW_SEC = 60;
/** Сколько соседних предложений давать этапу 05 как контекст тезиса */
const SURROUNDING_SEGMENTS = 2;
const MAX_SURROUNDING_CHARS = 1500;

export interface RunPipelineParams {
  jobId: JobId;
  request: StartAnalysisRequest;
  emit: (event: ServerEvent) => void;
  signal: AbortSignal;
  liveAudio?: AsyncIterable<LiveAudioChunk>;
}

export async function runPipeline({ jobId, request, emit, signal, liveAudio }: RunPipelineParams) {
  const ctx: StageContext = {
    jobId,
    signal,
    log: (msg, data) => console.log(`[${jobId}] ${msg}`, data ?? ""),
  };
  const { maxClaimsPerChunk, maxClaimsPerJob } = config.limits;

  const { video, chunks } = await ingest({ jobId, request, liveAudio, chunkSec: 30 }, ctx);
  emit({ type: "job.started", jobId, video });

  const results = new Map<string, FactCheck>();
  let history: TranscriptSegment[] = [];
  /** Все найденные тезисы (и отобранные, и нет) — чтобы этап 03 не находил их повторно */
  const seen: Claim[] = [];
  let checkedCount = 0;
  let processedUntil = request.startFrom;
  /**
   * Цепочка «кусок проверен»: прогресс verification шлём по порядку кусков, даже если тезисы
   * позднего куска проверились раньше — иначе полоса прогресса на фронте прыгала бы вперёд-назад.
   */
  let verified: Promise<void> = Promise.resolve();

  for await (const chunk of chunks) {
    if (signal.aborted) return;

    const transcript = await transcribe({ chunk, languageHint: request.languageHint }, ctx);
    emit({ type: "job.progress", jobId, processedUntil: chunk.range.end, stage: "transcription" });

    const { claims: found } = await extractClaims(
      {
        jobId,
        video,
        segments: transcript.segments,
        context: history.filter((s) => s.end >= chunk.range.start - CONTEXT_WINDOW_SEC),
        previousClaims: seen.map(({ id, normalized }) => ({ id, normalized })),
        language: transcript.language,
      },
      ctx,
    );
    history = [...history, ...transcript.segments];
    seen.push(...found);

    // Самые важные тезисы, в пределах лимитов на кусок и на весь материал
    const toCheck = found
      .filter((c) => c.checkworthiness >= CHECKWORTHINESS_THRESHOLD)
      .sort((a, b) => b.checkworthiness - a.checkworthiness)
      .slice(0, Math.min(maxClaimsPerChunk, maxClaimsPerJob - checkedCount));
    checkedCount += toCheck.length;
    if (found.length > toCheck.length) {
      ctx.log(
        `тезисов ${found.length}, проверяем ${toCheck.length} (лимиты: ${maxClaimsPerChunk}/кусок, ${maxClaimsPerJob}/всего)`,
      );
    }

    for (const claim of toCheck) {
      emit({ type: "claim.detected", jobId, factCheck: toFactCheck({ kind: "pending", claim }) });
    }

    // Проверка — в фоне; цикл сразу идёт за следующим куском
    const snapshot = history;
    const chunkEnd = chunk.range.end;
    const checks = Promise.all(toCheck.map((claim) => checkClaim(claim, snapshot)));
    verified = Promise.all([verified, checks]).then(() => {
      if (signal.aborted) return;
      processedUntil = Math.max(processedUntil, chunkEnd);
      emit({ type: "job.progress", jobId, processedUntil, stage: "verification" });
    });
  }

  await verified;
  if (signal.aborted) return;

  emit({
    type: "job.completed",
    jobId,
    report: {
      jobId,
      video,
      status: "completed",
      processedUntil,
      factChecks: [...results.values()].sort((a, b) => a.range.start - b.range.start),
    },
  });

  /** Поиск источников + оценка одного тезиса. Никогда не бросает: ошибка → FactCheck "failed". */
  async function checkClaim(claim: Claim, segments: TranscriptSegment[]): Promise<void> {
    let fc: FactCheck;
    try {
      const { sources } = await searchSources(
        // язык материала + румынский и русский (молдавское инфопространство) + английский
        { claim, maxSources: 5, searchLanguages: [...new Set([claim.language, "ro", "ru", "en"])] },
        ctx,
      );
      const verification = await verify(
        { claim, sources, surroundingText: surroundingText(claim, segments), uiLanguage: request.uiLanguage },
        ctx,
      );
      fc = toFactCheck({ kind: "checked", claim, sources, verification });
    } catch (err) {
      if (signal.aborted) return;
      ctx.log("claim failed", err);
      fc = toFactCheck({ kind: "failed", claim, error: "Не удалось проверить тезис" });
    }
    results.set(fc.id, fc);
    emit({ type: "claim.checked", jobId, factCheck: fc });
  }
}

/**
 * Контекст тезиса для этапа 05: соседние предложения вокруг тех, где он прозвучал.
 * Раньше брали «всё в пределах 30 секунд» — у текста статьи все таймкоды 0, и в промпт уходила вся статья.
 */
function surroundingText(claim: Claim, segments: TranscriptSegment[]): string {
  const ids = new Set(claim.segmentIds);
  const first = segments.findIndex((s) => ids.has(s.id));
  const picked =
    first < 0
      ? segments.filter((s) => Math.abs(s.start - claim.range.start) <= 30)
      : segments.slice(Math.max(0, first - SURROUNDING_SEGMENTS), first + ids.size + SURROUNDING_SEGMENTS);
  return picked
    .map((s) => s.text)
    .join(" ")
    .slice(0, MAX_SURROUNDING_CHARS);
}
