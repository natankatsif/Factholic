/**
 * Склеивает этапы 01 → 06 и шлёт события во фронт.
 *
 *   ingest ──chunk──▶ transcribe ──segments──▶ extractClaims ──claim──▶ (claim.detected)
 *                                                                 └──▶ searchSources ──▶ verify ──▶ (claim.checked)
 *
 * Куски обрабатываются по порядку, а тезисы внутри куска — параллельно.
 */
import type { FactCheck, JobId, ServerEvent, StartAnalysisRequest } from "@news/contracts";
import { ingest, type LiveAudioChunk } from "../stages/01-ingest/index.ts";
import { transcribe, type TranscriptSegment } from "../stages/02-transcription/index.ts";
import { CHECKWORTHINESS_THRESHOLD, extractClaims, type Claim } from "../stages/03-claim-extraction/index.ts";
import { searchSources } from "../stages/04-source-search/index.ts";
import { verify } from "../stages/05-verification/index.ts";
import { toFactCheck } from "../stages/06-delivery/index.ts";
import type { StageContext } from "./context.ts";

const CONTEXT_WINDOW_SEC = 60;

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

  const { video, chunks } = await ingest({ jobId, request, liveAudio, chunkSec: 30 }, ctx);
  emit({ type: "job.started", jobId, video });

  const results = new Map<string, FactCheck>();
  let history: TranscriptSegment[] = [];
  const claims: Claim[] = [];
  let processedUntil = request.startFrom;

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
        previousClaims: claims.map(({ id, normalized }) => ({ id, normalized })),
        language: transcript.language,
      },
      ctx,
    );
    history = [...history, ...transcript.segments];

    const toCheck = found.filter((c) => c.checkworthiness >= CHECKWORTHINESS_THRESHOLD);
    claims.push(...toCheck);

    await Promise.all(
      toCheck.map(async (claim) => {
        emit({ type: "claim.detected", jobId, factCheck: toFactCheck({ kind: "pending", claim }) });
        let fc: FactCheck;
        try {
          const { sources } = await searchSources(
            { claim, maxSources: 5, searchLanguages: [...new Set([claim.language, "en"])] },
            ctx,
          );
          const surroundingText = history
            .filter((s) => Math.abs(s.start - claim.range.start) <= 30)
            .map((s) => s.text)
            .join(" ");
          const verification = await verify(
            { claim, sources, surroundingText, uiLanguage: request.uiLanguage },
            ctx,
          );
          fc = toFactCheck({ kind: "checked", claim, sources, verification });
        } catch (err) {
          ctx.log("claim failed", err);
          fc = toFactCheck({ kind: "failed", claim, error: "Не удалось проверить тезис" });
        }
        results.set(fc.id, fc);
        emit({ type: "claim.checked", jobId, factCheck: fc });
      }),
    );

    processedUntil = chunk.range.end;
    emit({ type: "job.progress", jobId, processedUntil, stage: "verification" });
  }

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
}
