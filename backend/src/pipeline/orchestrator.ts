/**
 * Склеивает этапы 01 → 09 и шлёт события во фронт.
 *
 *   ingest ─▶ transcribe ─▶ extractClaims ─claim─▶ (claim.detected)
 *                                  └─▶ searchSources ─copies─▶ buildProvenanceTree ─tree─┬▶ findMutations ─┐
 *                                             │                                         ├▶ checkRootDate ─┤
 *                                             └─sources───────────────────────────────▶ └▶ assessStances ─┴▶ toFactCheck ─▶ (claim.checked)
 *
 * Конвейер: куски транскрибируются и разбираются на тезисы по порядку, а проверка тезисов (поиск + LLM —
 * самое долгое) идёт в фоне. Следующий кусок не ждёт, пока проверятся тезисы предыдущего.
 * Проверяются только самые важные тезисы (config.limits) — каждый стоит ~9 запросов к поиску.
 * Дерево и проверки на нём не валят тезис: ошибка этапа 05 → отчёт без дерева, но со сторонами.
 */
import type { ClaimStage, FactCheck, JobId, ServerEvent, StartAnalysisRequest } from "@news/contracts";
import { config } from "../config.ts";
import { ingest, type LiveAudioChunk } from "../stages/01-ingest/index.ts";
import { transcribe, type TranscriptSegment } from "../stages/02-transcription/index.ts";
import { CHECKWORTHINESS_THRESHOLD, extractClaims, type Claim } from "../stages/03-claim-extraction/index.ts";
import { searchSources, type SourceCopy } from "../stages/04-source-search/index.ts";
import {
  buildProvenanceTree,
  copiesForTree,
  voteGroupsForSources,
  type ProvenanceTree,
} from "../stages/05-provenance/index.ts";
import { findMutations } from "../stages/06-mutations/index.ts";
import { checkRootDate } from "../stages/07-root-date/index.ts";
import { assessStances } from "../stages/08-stances/index.ts";
import { toFactCheck, type ProvenanceResult } from "../stages/09-report/index.ts";
import type { StageContext } from "./context.ts";

const CONTEXT_WINDOW_SEC = 60;
/** Сколько соседних предложений давать этапу 08 (стороны) как контекст тезиса */
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
  let transcribedUntil = request.startFrom;
  /** До какой секунды проверены все тезисы (по порядку кусков) — уходит в job.completed */
  let processedUntil = request.startFrom;
  let verified: Promise<void> = Promise.resolve();

  for await (const chunk of chunks) {
    if (signal.aborted) return;

    const transcript = await transcribe({ chunk, languageHint: request.languageHint }, ctx);
    transcribedUntil = Math.max(transcribedUntil, chunk.range.end);
    emit({ type: "job.progress", jobId, processedUntil: transcribedUntil, stage: "transcription" });

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
    emit({ type: "job.progress", jobId, processedUntil: transcribedUntil, stage: "claim_extraction" });

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
      processedUntil = Math.max(processedUntil, chunkEnd);
    });
  }

  // Материал разобран целиком — дальше только проверки тезисов (шаги «Субтитры» и «Утверждения» на фронте готовы)
  if (signal.aborted) return;
  ctx.log(`материал разобран: тезисов на проверку ${checkedCount}`);
  emit({ type: "job.progress", jobId, processedUntil: transcribedUntil, stage: "verification" });

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

  /**
   * Поиск источников → дерево → проверки на нём → отчёт по одному тезису.
   * Никогда не бросает: ошибка поиска или сторон → FactCheck "failed".
   */
  async function checkClaim(claim: Claim, segments: TranscriptSegment[]): Promise<void> {
    let fc: FactCheck;
    try {
      progress(claim, "source_search");
      const t0 = Date.now();
      const lap = (from: number) => `${((Date.now() - from) / 1000).toFixed(1)}с`;
      const { sources, copies, search } = await searchSources(
        // язык материала + румынский и русский (молдавское инфопространство) + английский
        {
          claim,
          maxSources: 5,
          searchLanguages: [...new Set([claim.language, "ro", "ru", "en"])],
        },
        ctx,
      );
      // copies заполняет real-реализация 04; пустые/неполные (и у старых моков) — добираем из sources
      const treeCopies = copiesForTree(copies, sources);
      progress(
        claim,
        "provenance",
        `источников ${sources.length}, копий ${treeCopies.length}`,
        sources.length,
      );
      const t04 = Date.now();
      const tree = await buildTree(claim, treeCopies);
      const t05 = Date.now();
      progress(claim, "stances", tree ? `узлов в дереве ${tree.nodes.length}` : "без дерева");
      // три проверки висят на дереве: мутации и стороны — параллельно, дата корня — без внешних API
      let t06 = 0;
      let t08 = 0;
      const [mutations, stances] = await Promise.all([
        tree
          ? findMutations({ claim, tree, uiLanguage: request.uiLanguage }, ctx)
              .catch((err: unknown) => {
                ctx.log("06: мутации не найдены", err);
                return null;
              })
              .finally(() => (t06 = Date.now() - t05))
          : null,
        // перепечатки одного корня — один голос
        assessStances(
          {
            claim,
            sources,
            surroundingText: surroundingText(claim, segments),
            uiLanguage: request.uiLanguage,
            voteGroups: tree ? voteGroupsForSources(tree, treeCopies, sources) : undefined,
          },
          ctx,
        ).finally(() => (t08 = Date.now() - t05)),
      ]);
      const provenance: ProvenanceResult | null = tree
        ? { tree, mutations, rootDate: checkRootDate({ claim, tree, videoPublishedAt: video.publishedAt }) }
        : null;
      fc = toFactCheck({ kind: "checked", claim, sources, stances, provenance, search });
      ctx.log(
        `⏱ ${claim.id}: 04 поиск ${((t04 - t0) / 1000).toFixed(1)}с, 05 дерево ${((t05 - t04) / 1000).toFixed(1)}с, ` +
          `06 мутации ${(t06 / 1000).toFixed(1)}с ‖ 08 стороны ${(t08 / 1000).toFixed(1)}с, всего ${lap(t0)}`,
      );
    } catch (err) {
      if (signal.aborted) return;
      ctx.log("claim failed", err);
      fc = toFactCheck({ kind: "failed", claim, error: "Не удалось проверить тезис" });
    }
    results.set(fc.id, fc);
    emit({ type: "claim.checked", jobId, factCheck: fc });
  }

  /** Этап проверки тезиса → claim.progress во фронт и строка в лог */
  function progress(claim: Claim, stage: ClaimStage, detail?: string, sourcesFound?: number): void {
    if (signal.aborted) return;
    ctx.log(`${claim.id}: ${stage}${detail ? ` (${detail})` : ""}`);
    emit({ type: "claim.progress", jobId, claimId: claim.id, stage, sourcesFound });
  }

  /** Дерево первоисточника; ошибка — null, тезис проверяется дальше (стороны без группировки) */
  async function buildTree(claim: Claim, copies: SourceCopy[]): Promise<ProvenanceTree | null> {
    try {
      return await buildProvenanceTree(
        { claim, copies, video: { url: video.pageUrl, title: video.title, publishedAt: video.publishedAt } },
        ctx,
      );
    } catch (err) {
      if (!signal.aborted) ctx.log("05: дерево не построено", err);
      return null;
    }
  }
}

/**
 * Контекст тезиса для этапа 08: соседние предложения вокруг тех, где он прозвучал.
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
