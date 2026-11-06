/**
 * Проверка утверждений одной задачи по требованию: поиск источников → дерево → проверки на нём → отчёт.
 *
 *   searchSources ─copies─▶ buildProvenanceTree ─tree─┬▶ findMutations ─┐
 *        │                                           ├▶ checkRootDate ─┤
 *        └─sources─────────────────────────────────▶ └▶ assessStances ─┴▶ toFactCheck ─▶ (claim.checked)
 *
 * Что и когда проверять, решает очередь (scheduler.ts): текущее в плеере и два следующих, открытые пользователем.
 * Живёт дольше пайплайна: после job.completed пользователь смотрит видео, и проверки идут дальше.
 * Ошибка дерева не валит тезис: отчёт без дерева, но со сторонами.
 */
import type {
  ClaimStage,
  FactCheck,
  JobId,
  ServerEvent,
  StartAnalysisRequest,
  VideoInfo,
} from "@news/contracts";
import { config } from "../config.ts";
import type { TranscriptSegment } from "../stages/02-transcription/index.ts";
import type { Claim } from "../stages/03-claim-extraction/index.ts";
import { searchSources, type PreviousSearch, type SourceCopy } from "../stages/04-source-search/index.ts";
import {
  buildProvenanceTree,
  copiesForTree,
  voteGroupsForSources,
  voteRolesForSources,
  votersFromTree,
  type ProvenanceTree,
} from "../stages/05-provenance/index.ts";
import { findMutations } from "../stages/06-mutations/index.ts";
import { checkRootDate } from "../stages/07-root-date/index.ts";
import { assessStances } from "../stages/08-stances/index.ts";
import { toFactCheck, type ProvenanceResult } from "../stages/09-report/index.ts";
import type { StageContext } from "./context.ts";
import { messagesFor } from "../messages.ts";
import { allow } from "./guard.ts";
import { CheckScheduler } from "./scheduler.ts";

/** Сколько утверждений после текущего в плеере проверять заранее как минимум */
export const LOOKAHEAD_CLAIMS = 2;
/** На сколько секунд вперёд от плеера проверять: поиск и дерево занимают время, итог должен успеть до момента */
export const LOOKAHEAD_SEC = 120;
/** Сколько соседних предложений давать этапу 08 (стороны) как контекст тезиса */
const SURROUNDING_SEGMENTS = 2;
const MAX_SURROUNDING_CHARS = 1500;

export interface ClaimCheckerParams {
  jobId: JobId;
  request: StartAnalysisRequest;
  video: VideoInfo;
  emit: (event: ServerEvent) => void;
  signal: AbortSignal;
  ctx: StageContext;
  /** IP того, кто начал задачу: проверки считаются в его лимит (pipeline/guard.ts) */
  ownerIp?: string;
}

/** Что нужно сохранить, чтобы проверять по требованию и после перезапуска сервера */
export interface CheckerSnapshot {
  claims: Claim[];
  segments: TranscriptSegment[];
  /** Прошлый поиск по утверждениям: кнопка «Найти ещё» его дополняет */
  searches?: Record<string, PreviousSearch>;
}

/** На диске хватает начала страницы: её всё равно читают по кускам */
const SAVED_PAGE_CHARS = 8_000;

export class ClaimChecker {
  private readonly p: ClaimCheckerParams;
  private readonly scheduler: CheckScheduler<Claim>;
  private claims: Claim[] = [];
  private segments: TranscriptSegment[] = [];
  /** Последнее состояние каждого утверждения — для job.completed */
  private readonly results = new Map<string, FactCheck>();
  private readonly searches = new Map<string, PreviousSearch>();
  /** Нажали «Найти ещё»: следующая проверка дополняет прошлый поиск */
  private readonly extended = new Set<string>();

  constructor(p: ClaimCheckerParams) {
    this.p = p;
    const isShorts = Boolean(p.video && p.video.durationSec > 0 && p.video.durationSec <= 90);
    const hasPlayer = !p.request.text && !p.request.imageDataUrl && p.video.durationSec > 0;
    // статья по ссылке: утверждения обведены на странице и проверяются по клику, как в видео
    const isArticle = !p.request.text && !p.request.imageDataUrl;
    const maxChecks =
      hasPlayer || isArticle ? config.limits.maxClaimsPerVideo : config.limits.maxClaimsPerJob;
    this.scheduler = new CheckScheduler<Claim>({
      run: (claim) => this.check(claim),
      concurrency: isShorts ? Math.max(config.limits.checkParallel, 4) : config.limits.checkParallel,
      lookahead: isShorts ? 6 : LOOKAHEAD_CLAIMS,
      horizonSec: LOOKAHEAD_SEC,
      maxChecks,
      onLimit: (claim) => p.ctx.log(`${claim.id}: не проверяем — потолок ${maxChecks} проверок на материал`),
    });
  }

  /**
   * Найденные утверждения → claim.detected (status "found"), в очередь.
   * segments — весь текст на этот момент (контекст для этапа 08).
   */
  add(claims: Claim[], segments: TranscriptSegment[]): void {
    this.segments = segments;
    this.claims.push(...claims);
    for (const claim of claims)
      this.update(
        toFactCheck({ kind: "found", claim, uiLanguage: this.p.request.uiLanguage }),
        "claim.detected",
      );
    this.scheduler.add(claims);
  }

  /**
   * Восстановление после перезапуска сервера: утверждения из сохранённого отчёта, уже проверенные — не трогаем.
   * Событий не шлёт: отчёт у клиентов уже есть.
   */
  restore(snapshot: CheckerSnapshot, factChecks: FactCheck[]): void {
    this.segments = snapshot.segments;
    this.claims = [...snapshot.claims];
    for (const fc of factChecks) this.results.set(fc.id, fc);
    for (const [id, search] of Object.entries(snapshot.searches ?? {})) this.searches.set(id, search);
    const done = new Set(
      factChecks.filter((fc) => fc.status === "done" || fc.status === "failed").map((f) => f.id),
    );
    this.scheduler.add(snapshot.claims, done);
  }

  /** Позиция плеера (ClientMessage "playback"); null — никто не смотрит */
  playhead(sec: number | null): void {
    this.scheduler.playhead(sec);
  }

  /** Пользователь открыл утверждение (ClientMessage "claim.check" / POST …/check) */
  request(claimId: string): boolean {
    // упавшее (например, кончился лимит поиска) — проверяем заново, иначе оно так и останется без источников
    const ok =
      this.results.get(claimId)?.status === "failed"
        ? this.scheduler.retry(claimId)
        : this.scheduler.request(claimId);
    this.p.ctx.log(`${claimId}: запрошена проверка${ok ? "" : " — не принята"}`);
    return ok;
  }

  /** Кнопка «Найти ещё». false — утверждение ещё проверяется */
  more(claimId: string): boolean {
    this.extended.add(claimId);
    const ok = this.scheduler.again(claimId);
    if (!ok) this.extended.delete(claimId);
    this.p.ctx.log(`${claimId}: найти ещё${ok ? "" : " — не принято"}`);
    return ok;
  }

  /** Все ушли со страницы — новых проверок не начинаем */
  pause(): void {
    this.scheduler.clearQueue();
  }

  /**
   * Текст статьи: плеера нет — самые важные limit проверяем сразу, остальные — в фоне, пока человек читает
   * готовое (открытое по клику всё равно идёт вне очереди)
   */
  requestTop(claims: Claim[], limit: number): void {
    const byWorth = [...claims].sort((a, b) => b.checkworthiness - a.checkworthiness);
    const top = byWorth.slice(0, limit);
    // request ставит в начало очереди — в обратном порядке, чтобы самое важное пошло первым
    for (const c of top.reverse()) this.scheduler.request(c.id);
    this.scheduler.background(byWorth.slice(limit).map((c) => c.id));
  }

  has(claimId: string): boolean {
    return this.scheduler.status(claimId) !== undefined;
  }

  factChecks(): FactCheck[] {
    return [...this.results.values()];
  }

  snapshot(): CheckerSnapshot {
    const searches = [...this.searches].map(([id, search]) => [
      id,
      {
        ...search,
        copies: search.copies.map((copy) => ({
          ...copy,
          fullText: copy.fullText?.slice(0, SAVED_PAGE_CHARS),
        })),
      },
    ]);
    return { claims: this.claims, segments: this.segments, searches: Object.fromEntries(searches) };
  }

  whenIdle(): Promise<void> {
    return this.scheduler.whenIdle();
  }

  private update(fc: FactCheck, type: "claim.detected" | "claim.checked"): void {
    this.results.set(fc.id, fc);
    if (this.p.signal.aborted) return;
    this.p.emit({ type, jobId: this.p.jobId, factCheck: fc } as ServerEvent);
  }

  /**
   * Поиск источников → дерево → проверки на нём → отчёт по одному тезису.
   * Никогда не бросает: ошибка поиска или сторон → FactCheck "failed".
   */
  private async check(claim: Claim): Promise<void> {
    const { ctx, signal, request, video } = this.p;
    const extending = this.extended.delete(claim.id);
    const previous = extending ? this.searches.get(claim.id) : undefined;
    // прошлый результат остаётся на экране, пока идёт новый поиск, и после ошибки
    const shown = extending ? this.results.get(claim.id) : undefined;
    // лимит на человека и дневной бюджет: не потратили — «не удалось» с причиной, по клику перепроверится
    const denied = allow("check", this.p.ownerIp, request.uiLanguage);
    if (denied) {
      ctx.log(`${claim.id}: не проверяем — ${denied}`);
      this.update(
        shown ?? toFactCheck({ kind: "failed", claim, error: denied, uiLanguage: request.uiLanguage }),
        "claim.checked",
      );
      return;
    }
    if (!shown)
      this.update(toFactCheck({ kind: "pending", claim, uiLanguage: request.uiLanguage }), "claim.detected");
    let fc: FactCheck;
    try {
      ctx.activity?.({ kind: "start" });
      this.progress(claim, "source_search");
      const t0 = Date.now();
      const {
        queries,
        sources: found,
        copies,
        search,
      } = await searchSources(
        // язык материала + румынский и русский (молдавское инфопространство) + английский
        {
          claim,
          maxSources: 5,
          searchLanguages: [...new Set([claim.language, "ro", "ru", "en"])],
          previous,
        },
        ctx,
      );
      this.searches.set(claim.id, { queries, sources: found, search, copies: copies ?? [] });
      // copies заполняет real-реализация 04; пустые/неполные (и у старых моков) — добираем из sources
      const treeCopies = copiesForTree(copies, found);
      this.progress(
        claim,
        "provenance",
        `источников ${found.length}, копий ${treeCopies.length}`,
        found.length,
      );
      const t04 = Date.now();
      const tree = await this.buildTree(claim, treeCopies);
      const t05 = Date.now();
      if (tree) {
        const links = tree.nodes.filter((node) => node.parentId).length;
        ctx.activity?.({ kind: "tree", publications: tree.nodes.length - 1, links });
      }
      this.progress(claim, "stances", tree ? `узлов в дереве ${tree.nodes.length}` : "без дерева");
      // голосуют и независимые ветки дерева: в выборку этапа 04 они могли не попасть
      const voters = tree && config.experiments.traceSearch ? votersFromTree(tree, treeCopies, found) : [];
      const sources = [...found, ...voters];
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
            surroundingText: surroundingText(claim, this.segments),
            uiLanguage: request.uiLanguage,
            voteGroups: tree ? voteGroupsForSources(tree, treeCopies, sources) : undefined,
            voteRoles: tree ? voteRolesForSources(tree, treeCopies, sources) : undefined,
          },
          ctx,
        ).finally(() => (t08 = Date.now() - t05)),
      ]);
      const provenance: ProvenanceResult | null = tree
        ? { tree, mutations, rootDate: checkRootDate({ claim, tree, videoPublishedAt: video.publishedAt }) }
        : null;
      fc = toFactCheck({
        kind: "checked",
        claim,
        sources,
        stances,
        provenance,
        search,
        uiLanguage: request.uiLanguage,
      });
      ctx.log(
        `⏱ ${claim.id}: 04 поиск ${sec(t04 - t0)}, 05 дерево ${sec(t05 - t04)}, ` +
          `06 мутации ${sec(t06)} ‖ 08 стороны ${sec(t08)}, всего ${sec(Date.now() - t0)}`,
      );
    } catch (err) {
      if (signal.aborted) return;
      ctx.log("claim failed", err);
      fc =
        shown ??
        toFactCheck({
          kind: "failed",
          claim,
          error: messagesFor(request.uiLanguage).claimCheckFailed,
          uiLanguage: request.uiLanguage,
        });
    }
    this.update(fc, "claim.checked");
  }

  /** Этап проверки тезиса → claim.progress во фронт и строка в лог */
  private progress(claim: Claim, stage: ClaimStage, detail?: string, sourcesFound?: number): void {
    if (this.p.signal.aborted) return;
    this.p.ctx.log(`${claim.id}: ${stage}${detail ? ` (${detail})` : ""}`);
    this.p.emit({ type: "claim.progress", jobId: this.p.jobId, claimId: claim.id, stage, sourcesFound });
  }

  /** Дерево первоисточника; ошибка — null, тезис проверяется дальше (стороны без группировки) */
  private async buildTree(claim: Claim, copies: SourceCopy[]): Promise<ProvenanceTree | null> {
    const { video, ctx, signal } = this.p;
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

function sec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}с`;
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
