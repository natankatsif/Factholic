/**
 * Склеивает этапы и шлёт события во фронт.
 *
 *   ingest ─▶ transcribe ─▶ extractClaims ─claims─▶ (claim.detected, status "found") ─▶ ClaimChecker
 *
 * Все утверждения находятся сразу (это дёшево: один вызов LLM на кусок) и показываются серыми.
 * Проверяются (поиск + LLM — дорого) только нужные — это решает ClaimChecker (checks.ts, scheduler.ts):
 * текущее в плеере и два следующих, открытые пользователем. У текста статьи плеера нет — самые важные сразу,
 * остальные — в фоне, пока человек читает уже проверенное.
 *
 * Куски транскрибируются по порядку, а разбираются на утверждения параллельно (до EXTRACT_PARALLEL):
 * для длинного видео серый список появляется за десятки секунд, а не за минуты.
 * job.completed — материал разобран на утверждения; проверки по требованию идут и после него.
 */
import type { JobId, ServerEvent, StartAnalysisRequest } from "@news/contracts";
import { config } from "../config.ts";
import { ingest, type LiveAudioChunk } from "../stages/01-ingest/index.ts";
import {
  transcribe,
  type TranscriptionOutput,
  type TranscriptSegment,
} from "../stages/02-transcription/index.ts";
import { CHECKWORTHINESS_THRESHOLD, extractClaims, type Claim } from "../stages/03-claim-extraction/index.ts";
import { ClaimChecker } from "./checks.ts";
import type { StageContext } from "./context.ts";

const CONTEXT_WINDOW_SEC = 60;
/** Сколько кусков разбирать на утверждения одновременно */
const EXTRACT_PARALLEL = 4;

export interface RunPipelineParams {
  jobId: JobId;
  request: StartAnalysisRequest;
  emit: (event: ServerEvent) => void;
  signal: AbortSignal;
  liveAudio?: AsyncIterable<LiveAudioChunk>;
  /** Очередь проверок создана — сервер передаёт в неё позицию плеера и запросы пользователя */
  onChecker?: (checker: ClaimChecker) => void;
  /** IP того, кто начал задачу: проверки считаются в его лимит (pipeline/guard.ts) */
  ownerIp?: string;
}

export async function runPipeline({
  jobId,
  request,
  emit,
  signal,
  liveAudio,
  onChecker,
  ownerIp,
}: RunPipelineParams) {
  const ctx: StageContext = {
    jobId,
    signal,
    log: (msg, data) => console.log(`[${jobId}] ${msg}`, data ?? ""),
  };

  const { video, chunks } = await ingest({ jobId, request, liveAudio, chunkSec: 30 }, ctx);
  emit({ type: "job.started", jobId, video });

  const checker = new ClaimChecker({ jobId, request, video, emit, signal, ctx, ownerIp });
  onChecker?.(checker);
  // у видео есть плеер: пока клиент не прислал позицию, проверяем начало (откуда смотрят)
  const hasPlayer = !request.text && !request.imageDataUrl && video.durationSec > 0;
  if (hasPlayer) checker.playhead(request.startFrom);

  let history: TranscriptSegment[] = [];
  /** Все найденные утверждения — чтобы этап 03 не находил их повторно */
  const seen: Claim[] = [];
  let worthyCount = 0;
  let transcribedUntil = request.startFrom;

  // куски разбираются параллельно; processedUntil — до куда разобрано подряд, без дыр
  const chunkEnds: number[] = [];
  const extracted = new Set<number>();
  let processedUntil = request.startFrom;
  const inflight = new Set<Promise<void>>();
  let failure: unknown = null;
  let emptyNotice: string | undefined = undefined;

  const extractChunk = async (
    index: number,
    transcript: TranscriptionOutput,
    context: TranscriptSegment[],
  ) => {
    const { claims: found, replyWhenNoClaims } = await extractClaims(
      {
        jobId,
        video,
        segments: transcript.segments,
        context,
        previousClaims: seen.map(({ id, normalized }) => ({ id, normalized })),
        language: transcript.language,
      },
      ctx,
    );
    if (signal.aborted) return;
    seen.push(...found);
    if (replyWhenNoClaims && !emptyNotice) {
      emptyNotice = replyWhenNoClaims;
    }
    const worthy = found.filter((c) => c.checkworthiness >= CHECKWORTHINESS_THRESHOLD);
    worthyCount += worthy.length;
    ctx.log(`кусок ${index + 1}: утверждений ${found.length}, спорных ${worthy.length}`);
    checker.add(worthy, history);
    // текст статьи: плеера нет — самые важные проверяем сразу, остальные — в фоне
    if (!hasPlayer) {
      checker.requestTop(worthy, config.limits.maxClaimsPerChunk);
    } else if (video && video.durationSec > 0 && video.durationSec <= 90) {
      // Для коротких видео (шортсы/рилсы <= 90 сек) запускаем проверку всех тезисов сразу
      for (const c of worthy) checker.request(c.id);
    }

    extracted.add(index);
    let contiguous = 0;
    while (extracted.has(contiguous)) contiguous++;
    if (contiguous > 0) processedUntil = Math.max(processedUntil, chunkEnds[contiguous - 1]);
    emit({ type: "job.progress", jobId, processedUntil, stage: "claim_extraction" });
  };

  for await (const chunk of chunks) {
    if (signal.aborted) return;
    if (failure) throw failure;
    // каждый кусок — запрос к LLM: многочасовое видео разбираем только на первые MAX_CHUNKS_PER_JOB кусков
    if (chunkEnds.length >= config.limits.maxChunksPerJob) {
      ctx.log(`материал длинный: разбираем только первые ${config.limits.maxChunksPerJob} кусков`);
      break;
    }

    const transcript = await transcribe({ chunk, languageHint: request.languageHint }, ctx);
    transcribedUntil = Math.max(transcribedUntil, chunk.range.end);
    emit({ type: "job.progress", jobId, processedUntil: transcribedUntil, stage: "transcription" });

    const index = chunkEnds.push(chunk.range.end) - 1;
    const context = history.filter((s) => s.end >= chunk.range.start - CONTEXT_WINDOW_SEC);
    history = [...history, ...transcript.segments];

    const task = extractChunk(index, transcript, context).catch((err: unknown) => {
      failure ??= err;
    });
    inflight.add(task);
    void task.finally(() => inflight.delete(task));
    if (inflight.size >= EXTRACT_PARALLEL) await Promise.race(inflight);
  }
  await Promise.all(inflight);
  if (failure) throw failure;

  // Материал разобран целиком: дальше — проверки по требованию (шаги «Субтитры» и «Утверждения» на фронте готовы)
  if (signal.aborted) return;
  ctx.log(`материал разобран: спорных утверждений ${worthyCount}, проверка — по ходу просмотра`);
  emit({ type: "job.progress", jobId, processedUntil: transcribedUntil, stage: "verification" });

  const fullText = request.text || (history.length > 0 ? history.map((s) => s.text).join(" ") : undefined);
  const lower = fullText?.toLowerCase();
  const position = (quote: string) => {
    const clean = quote
      .replace(/^[«"“]+|[»"”]+$/g, "")
      .trim()
      .toLowerCase();
    return lower && clean ? lower.indexOf(clean) : -1;
  };
  const factChecks = checker.factChecks().sort((a, b) => {
    const idxA = position(a.quote);
    const idxB = position(b.quote);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.range.start - b.range.start;
  });

  emit({
    type: "job.completed",
    jobId,
    report: {
      jobId,
      video,
      status: "completed",
      processedUntil: transcribedUntil,
      sourceText: fullText,
      emptyNotice: factChecks.length === 0 ? emptyNotice : undefined,
      factChecks,
    },
  });
}
