/**
 * Логика кабинета: проверки, утверждения, слежение, уведомления, нарративы. Без HTTP и без внешних API:
 * запуск проверки приходит снаружи (JobRunner), поэтому всё это проверяется тестами бесплатно.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  type ClaimStage,
  type FactCheck,
  type JobId,
  type ServerEvent,
  type StartAnalysisRequest,
  type VideoReport,
} from "@news/contracts";
import { isPendingCheck } from "@news/contracts";
import { mixesAlphabets, type Clarifier, type ClarifyResult } from "./clarify.ts";
import { compareChecks, daysBetween, isQuiet, sidesOf, type Signal } from "./compare.ts";
import type { CabinetDb } from "./db.ts";
import { suggestGroups } from "./suggest.ts";
import type {
  OrgVideo,
  Alert,
  ClaimCheck,
  Clarification,
  ClarificationAnswer,
  CreateNarrativeRequest,
  CreateWatchRequest,
  Narrative,
  NarrativeQuote,
  NarrativeSuggestion,
  OrgApiError,
  OrgCheckDetail,
  OrgClaimScope,
  OrgEvent,
  OrgNarrativeDetail,
  OrgRunningCheck,
  OrgSearchStep,
  OrgSession,
  OrgStepKey,
  StartCheckResponse,
  TrackedClaim,
  Watch,
} from "./types.ts";

const STEP_KEYS: OrgStepKey[] = ["claims", "search", "traces", "tree", "stances", "done"];
/** Этап проверки утверждения → шаг в «В процессе» */
const MORE_STEPS: Partial<Record<ClaimStage, OrgStepKey>> = {
  source_search: "search",
  provenance: "tree",
  stances: "stances",
};
const MAX_INPUT_CHARS = 20_000;
const MAX_NARRATIVE_QUOTES = 12;
const QUOTES_PER_CLAIM = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
/** За сколько дней считаем, сколько публикаций выходит обычно */
const USUAL_WINDOW_DAYS = 30;
const FREQUENCY_DAYS = { daily: 1, weekly: 7 };
/** Утверждение застряло в очереди: завершаем проверку с тем, что есть */
const SETTLE_TIMEOUT_MS = 15 * 60 * 1000;
/** Видео считается готовым, когда проверены утверждения этих первых секунд (хотя бы одно) */
const VIDEO_BEGINNING_SEC = 45;

export class OrgError extends Error {
  constructor(
    readonly status: number,
    readonly code: OrgApiError["code"],
    message: string,
  ) {
    super(message);
  }
}

export interface JobRunner {
  start(request: StartAnalysisRequest, fresh: boolean): JobId;
  report(jobId: JobId): VideoReport | undefined;
  /** «Найти ещё» по готовому утверждению. false — оно сейчас проверяется */
  more(jobId: JobId, claimId: string): boolean;
  subscribe(jobId: JobId, listener: (event: ServerEvent) => void): () => void;
}

export interface CabinetOptions {
  organizationName: string;
  memberName: string;
  checksPerMonth: number;
  watches: number;
  /** Издания из списка организации: домены */
  bigOutlets?: string[];
  /** Нет — проверка начинается сразу, без вопроса */
  clarifier?: Clarifier;
  now?: () => Date;
  emit?: (event: OrgEvent) => void;
}

const DEFAULT_LOCALE = "ru";
const ORGANIZATION_ID = "org_default";
const MEMBER_ID = "member_default";

interface StoredReport {
  id: string;
  report: VideoReport;
}

const publicationCount = (factCheck?: FactCheck) =>
  factCheck?.provenance?.nodes.filter((node) => node.role !== "target").length ?? 0;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[«»"“”.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function isUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}

/** id ролика YouTube, если это ссылка на него: такую проверку ведём как видео */
function youtubeId(input: string): string | undefined {
  if (!isUrl(input)) return undefined;
  return input.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
  )?.[1];
}

/** Те же условия, что у загрузки на видео в кабинете: web/src/components/verification/VerificationScreen.tsx */
function videoBeginningChecked(report: VideoReport): boolean {
  if (report.status !== "completed") return false;
  const early = report.factChecks.filter((factCheck) => factCheck.range.start < VIDEO_BEGINNING_SEC);
  const needed = early.length ? early : report.factChecks.slice(0, 1);
  return !needed.some(isPendingCheck);
}

function toRequest(input: string, locale: string): StartAnalysisRequest {
  const url = isUrl(input);
  const videoId = youtubeId(input);
  return {
    video: videoId
      ? { pageUrl: input.trim(), platform: "youtube", platformVideoId: videoId }
      : { pageUrl: url ? input.trim() : "text://cabinet", platform: "generic" },
    mode: "remote",
    startFrom: 0,
    uiLanguage: locale,
    ...(url ? {} : { text: input }),
  };
}

export class CabinetService {
  private stopSubscriptions = new Map<string, () => void>();
  /** Идущие «Найти ещё»: `${checkId}:${factCheckId}` → шаг. Только в памяти: сервер перезапустился — поиска уже нет */
  private searchingMore = new Map<string, OrgStepKey>();

  constructor(
    private db: CabinetDb,
    private runner: JobRunner,
    private options: CabinetOptions,
  ) {
    // сервер остановился посреди проверки: её пайплайна больше нет
    for (const check of this.db.list<ClaimCheck>("check")) {
      if (check.status === "running") this.failCheck(check);
    }
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private emit(event: OrgEvent): void {
    this.options.emit?.(event);
  }

  // ---------- проверки ----------

  private period() {
    const now = this.now();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, reset };
  }

  private checksUsed(): number {
    const { start } = this.period();
    return this.db
      .list<ClaimCheck>("check")
      .filter((check) => new Date(check.startedAt) >= start)
      .reduce((used, check) => used + 1 + (check.moreSearches ?? 0), 0);
  }

  private assertChecksLeft(): void {
    if (this.checksUsed() >= this.options.checksPerMonth) {
      throw new OrgError(429, "CHECK_LIMIT", "лимит проверок на месяц исчерпан");
    }
  }

  /** Сначала уточнение; если вопросов нет или модель недоступна, проверка начинается сразу */
  async requestCheck(input: string, locale = DEFAULT_LOCALE): Promise<StartCheckResponse> {
    const text = input?.trim();
    if (!text) throw new OrgError(400, "BAD_REQUEST", "пустой текст");
    this.assertChecksLeft();
    const clarifier = this.options.clarifier;
    if (!clarifier || isUrl(text)) return { check: this.startCheck(text, undefined, locale) };
    let result: ClarifyResult | undefined;
    try {
      result = await clarifier({ text, locale, now: this.now() });
    } catch (err) {
      console.error("cabinet: уточнение не удалось, проверяем как есть", err);
    }
    const rewritten = result?.rewritten.trim();
    if (!result?.needed || !rewritten || rewritten === text || mixesAlphabets(text, rewritten)) {
      return { check: this.startCheck(text, undefined, locale) };
    }
    const clarification = this.db.put<Clarification>("clarification", {
      id: randomUUID(),
      organizationId: ORGANIZATION_ID,
      input: text,
      question: result.question,
      rewritten,
      locale,
      status: "pending",
      createdAt: this.now().toISOString(),
    });
    return { clarification };
  }

  answerClarification(id: string, answer: ClarificationAnswer, text?: string): ClaimCheck {
    const clarification = this.db.get<Clarification>("clarification", id);
    if (!clarification || clarification.status !== "pending") {
      throw new OrgError(404, "NOT_FOUND", "вопрос не найден");
    }
    const final =
      answer === "yes" ? clarification.rewritten : answer === "other" ? text?.trim() : clarification.input;
    if (!final) throw new OrgError(400, "BAD_REQUEST", "пустой ответ");
    const check = this.startCheck(final, undefined, clarification.locale);
    this.db.put("clarification", { ...clarification, status: "answered" });
    return check;
  }

  private clarifications(): Clarification[] {
    return this.db
      .list<Clarification>("clarification")
      .filter((item) => item.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  startCheck(input: string, watchClaimId?: string, locale = DEFAULT_LOCALE): ClaimCheck {
    const text = input?.trim();
    if (!text) throw new OrgError(400, "BAD_REQUEST", "пустой текст");
    if (text.length > MAX_INPUT_CHARS) throw new OrgError(400, "BAD_REQUEST", "текст слишком длинный");
    const videoId = youtubeId(text);
    // то же видео уже разобрано: открываем его, лимит не тратим
    const known = videoId && this.knownVideo(videoId, locale);
    if (known) return known;
    this.assertChecksLeft();
    // слежению нужен новый поиск; обычная проверка того же текста может взять готовое
    const jobId = this.runner.start(toRequest(text, locale), Boolean(watchClaimId));
    const check: ClaimCheck = {
      id: randomUUID(),
      organizationId: ORGANIZATION_ID,
      input: text,
      locale,
      status: "running",
      jobId,
      steps: STEP_KEYS.map((key) => ({ key, status: key === "claims" ? "running" : "waiting" })),
      claimIds: [],
      watchClaimId,
      createdBy: MEMBER_ID,
      startedAt: this.now().toISOString(),
      ...(videoId ? { kind: "video" as const } : {}),
    };
    this.db.put("check", check);
    this.follow(check);
    return check;
  }

  private videoChecks(): ClaimCheck[] {
    return this.db
      .list<ClaimCheck>("check")
      .filter((check) => check.kind === "video")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  private knownVideo(videoId: string, locale: string): ClaimCheck | undefined {
    return this.videoChecks().find(
      (check) => check.status !== "failed" && check.locale === locale && youtubeId(check.input) === videoId,
    );
  }

  /** Отчёт видео: живой, потому что утверждения проверяются и после разбора, по ходу просмотра */
  private videoReport(check: ClaimCheck): VideoReport | undefined {
    return this.runner.report(check.jobId) ?? this.db.get<StoredReport>("report", check.id)?.report;
  }

  listVideos(): OrgVideo[] {
    return this.videoChecks().map((check) => {
      const report = this.videoReport(check);
      const factChecks = report?.factChecks ?? [];
      return {
        id: check.id,
        url: check.input,
        title: report?.video.title ?? "",
        thumbnailUrl: report?.video.thumbnailUrl,
        durationSec: report?.video.durationSec ?? 0,
        status: check.status,
        claims: factChecks.length,
        checked: factChecks.filter((factCheck) => factCheck.status === "done").length,
        startedAt: check.startedAt,
      };
    });
  }

  retryCheck(id: string): ClaimCheck {
    const check = this.db.get<ClaimCheck>("check", id);
    if (!check) throw new OrgError(404, "NOT_FOUND", "проверка не найдена");
    return this.startCheck(check.input, check.watchClaimId, check.locale);
  }

  private follow(check: ClaimCheck): void {
    const timer = setTimeout(() => this.settle(check.id, true), SETTLE_TIMEOUT_MS);
    timer.unref?.();
    const stop = this.runner.subscribe(check.jobId, (event) => this.onJobEvent(check.id, event));
    this.stopSubscriptions.set(check.id, () => {
      clearTimeout(timer);
      stop();
    });
    // подписка сразу отдаёт историю: готовая из кэша задача могла уже завершить проверку
    this.settle(check.id);
  }

  private unfollow(id: string): void {
    this.stopSubscriptions.get(id)?.();
    this.stopSubscriptions.delete(id);
  }

  private onJobEvent(id: string, event: ServerEvent): void {
    const check = this.db.get<ClaimCheck>("check", id);
    if (!check || check.status !== "running") return;
    if (event.type === "job.failed") return this.failCheck(check);
    if (applyStep(check.steps, event)) {
      this.db.put("check", check);
      this.emit({ type: "check.step", checkId: id });
    }
    if (event.type === "job.completed") this.settle(id);
    // следующий из очереди начнётся сразу после этого события, поэтому смотрим уже после него
    if (event.type === "claim.checked") setImmediate(() => this.settle(id));
  }

  private failCheck(check: ClaimCheck): void {
    check.status = "failed";
    check.finishedAt = this.now().toISOString();
    for (const step of check.steps) if (step.status === "running") step.status = "failed";
    this.db.put("check", check);
    const report = this.runner.report(check.jobId);
    if (report) this.db.put<StoredReport>("report", { id: check.id, report });
    this.unfollow(check.id);
    this.emit({ type: "check.failed", checkId: check.id });
  }

  /** Материал разобран и все утверждения проверены: сохраняем итог */
  private settle(id: string, force = false): void {
    const check = this.db.get<ClaimCheck>("check", id);
    if (!check || check.status !== "running") return;
    const report = this.runner.report(check.jobId);
    if (!report) return;
    if (check.kind === "video") return this.settleVideo(check, report, force);
    // «found» не ждём: утверждение сверх лимита не проверится никогда, и проверка зависла бы
    const busy = report.factChecks.some((factCheck) => factCheck.status === "checking");
    if (!force && (report.status !== "completed" || busy)) return;

    const usable = report.factChecks.filter((factCheck) => factCheck.status === "done");
    const allFailed = report.factChecks.length > 0 && usable.length === 0;
    if (allFailed) {
      this.failCheck(check);
      return;
    }
    this.db.put<StoredReport>("report", { id, report });
    check.status = "done";
    check.finishedAt = this.now().toISOString();
    check.noClaims = report.factChecks.length === 0;
    check.steps = check.steps.map((step) => ({ ...step, status: "done" }));
    if (check.watchClaimId) this.finishWatchCheck(check, usable);
    else check.claimIds = usable.map((factCheck) => this.upsertClaim(check, factCheck, report).id);
    this.db.put("check", check);
    this.refreshSuggestions();
    this.unfollow(id);
    this.emit({ type: "check.finished", checkId: id });
  }

  /**
   * Видео готово, когда разобрано и проверено его начало: до этого оно «в процессе», как и экран с загрузкой.
   * Остальное плеер просит по ходу просмотра. В общие вопросы утверждения не идут
   */
  private settleVideo(check: ClaimCheck, report: VideoReport, force: boolean): void {
    if (!force && !videoBeginningChecked(report)) return;
    this.db.put<StoredReport>("report", { id: check.id, report });
    check.status = "done";
    check.finishedAt = this.now().toISOString();
    check.noClaims = report.factChecks.length === 0;
    check.steps = check.steps.map((step) => ({ ...step, status: "done" }));
    this.db.put("check", check);
    this.unfollow(check.id);
    this.emit({ type: "check.finished", checkId: check.id });
  }

  private upsertClaim(check: ClaimCheck, factCheck: FactCheck, report: VideoReport): TrackedClaim {
    const key = normalize(factCheck.claim);
    const known = this.claims().find((claim) => normalize(claim.text) === key);
    const now = this.now().toISOString();
    return this.db.put<TrackedClaim>("claim", {
      ...(known ?? {
        id: randomUUID(),
        organizationId: ORGANIZATION_ID,
        text: factCheck.claim,
        quote: factCheck.quote,
        language: report.video.language,
        sourceUrl: isUrl(check.input) ? check.input : undefined,
        createdBy: check.createdBy,
        createdByName: this.options.memberName,
        createdAt: now,
        status: "new",
        checksCount: 0,
      }),
      latestCheckId: check.id,
      factCheckId: factCheck.id,
      checksCount: (known?.checksCount ?? 0) + 1,
      lastCheckAt: now,
      sides: sidesOf(factCheck),
    });
  }

  getCheck(id: string): OrgCheckDetail {
    const check = this.db.get<ClaimCheck>("check", id);
    if (!check) throw new OrgError(404, "NOT_FOUND", "проверка не найдена");
    const report =
      (check.kind === "video"
        ? this.videoReport(check)
        : (this.db.get<StoredReport>("report", id)?.report ?? this.runner.report(check.jobId))) ?? null;
    const ids = check.watchClaimId ? [check.watchClaimId] : check.claimIds;
    const claims = ids.flatMap((claimId) => this.db.get<TrackedClaim>("claim", claimId) ?? []);
    return {
      check,
      report,
      claims,
      watches: this.watches().filter((watch) => ids.includes(watch.claimId)),
      alerts: this.alerts().filter((alert) => ids.includes(alert.claimId)),
      searchingMore: [...this.searchingMore.keys()]
        .filter((key) => key.startsWith(`${id}:`))
        .map((key) => key.slice(id.length + 1)),
    };
  }

  /** «Найти ещё»: прошлые публикации остаются, новые дополняют то же дерево */
  searchMore(id: string, factCheckId: string): { ok: true } {
    const check = this.db.get<ClaimCheck>("check", id);
    if (!check) throw new OrgError(404, "NOT_FOUND", "проверка не найдена");
    const key = `${id}:${factCheckId}`;
    if (this.searchingMore.has(key)) return { ok: true };
    this.assertChecksLeft();
    const before = publicationCount(this.reportFactCheck(check, factCheckId));
    // подписка сначала отдаёт историю: ждём только событие нового поиска
    let live = false;
    const finish = () => {
      clearTimeout(timer);
      stop();
      this.searchingMore.delete(key);
    };
    const timer = setTimeout(finish, SETTLE_TIMEOUT_MS);
    timer.unref?.();
    const stop = this.runner.subscribe(check.jobId, (event) => {
      if (!live) return;
      if (event.type === "claim.progress" && event.claimId === factCheckId) {
        this.searchingMore.set(key, MORE_STEPS[event.stage] ?? "search");
        this.emit({ type: "check.step", checkId: id });
      }
      if (event.type !== "claim.checked" || event.factCheck.id !== factCheckId) return;
      finish();
      this.finishMore(id, event.factCheck, before);
    });
    live = true;
    this.searchingMore.set(key, "search");
    if (!this.runner.more(check.jobId, factCheckId)) {
      finish();
      throw new OrgError(400, "BAD_REQUEST", "утверждение ещё проверяется");
    }
    this.db.put("check", { ...check, moreSearches: (check.moreSearches ?? 0) + 1 });
    this.emit({ type: "check.step", checkId: id });
    return { ok: true };
  }

  /** Три точки у вопроса: поиск по последней проверке */
  repeatSearch(claimId: string): { ok: true } {
    const claim = this.db.get<TrackedClaim>("claim", claimId);
    if (!claim) throw new OrgError(404, "NOT_FOUND", "утверждение не найдено");
    return this.searchMore(claim.latestCheckId, claim.factCheckId);
  }

  private withSearching(claim: TrackedClaim): TrackedClaim {
    const searching = this.searchingMore.has(`${claim.latestCheckId}:${claim.factCheckId}`);
    return searching ? { ...claim, searching } : claim;
  }

  private reportFactCheck(check: ClaimCheck, factCheckId: string): FactCheck | undefined {
    const report = this.runner.report(check.jobId) ?? this.db.get<StoredReport>("report", check.id)?.report;
    return report?.factChecks.find((item) => item.id === factCheckId);
  }

  private finishMore(id: string, after: FactCheck, before: number): void {
    const check = this.db.get<ClaimCheck>("check", id);
    if (!check) return;
    const now = this.now().toISOString();
    const report = this.runner.report(check.jobId);
    if (report) this.db.put<StoredReport>("report", { id, report });
    const found = Math.max(0, publicationCount(after) - before);
    this.db.put("check", { ...check, lastMore: { found, at: now } });
    const ids = check.watchClaimId ? [check.watchClaimId] : check.claimIds;
    for (const claimId of ids) {
      const claim = this.db.get<TrackedClaim>("claim", claimId);
      if (claim?.factCheckId === after.id)
        this.db.put<TrackedClaim>("claim", {
          ...claim,
          checksCount: claim.checksCount + 1,
          lastCheckAt: now,
          sides: sidesOf(after),
        });
    }
    this.emit({ type: "check.finished", checkId: id });
  }

  /** Повторный поиск виден в «В процессе» так же, как обычная проверка */
  private runningMore(): OrgRunningCheck[] {
    return [...this.searchingMore].flatMap(([key, stepKey]) => {
      const separator = key.indexOf(":");
      const check = this.db.get<ClaimCheck>("check", key.slice(0, separator));
      const factCheck = check && this.reportFactCheck(check, key.slice(separator + 1));
      if (!check || !factCheck) return [];
      return [
        {
          id: check.id,
          claim: factCheck.claim.slice(0, 120),
          step: STEP_KEYS.indexOf(stepKey) + 1,
          totalSteps: STEP_KEYS.length,
          stepKey,
          found: publicationCount(factCheck),
          kind: check.kind,
        },
      ];
    });
  }

  private running(): OrgRunningCheck[] {
    const checks = this.db
      .list<ClaimCheck>("check")
      .filter((check) => check.status === "running")
      .map((check) => {
        const index = Math.max(check.steps.filter((step) => step.status !== "waiting").length - 1, 0);
        return {
          id: check.id,
          claim: ((check.kind === "video" && this.videoReport(check)?.video.title) || check.input).slice(
            0,
            120,
          ),
          step: index + 1,
          totalSteps: check.steps.length,
          stepKey: check.steps[index]!.key,
          found: check.steps.find((step) => step.key === "search")?.found ?? 0,
          kind: check.kind,
        };
      });
    return [...checks, ...this.runningMore()];
  }

  // ---------- утверждения ----------

  private claims(): TrackedClaim[] {
    return this.db.list<TrackedClaim>("claim").sort((a, b) => b.lastCheckAt.localeCompare(a.lastCheckAt));
  }

  listClaims(scope: OrgClaimScope): TrackedClaim[] {
    const watched = new Set(
      this.watches()
        .filter((w) => w.status !== "finished")
        .map((w) => w.claimId),
    );
    const running = new Set(
      this.db
        .list<ClaimCheck>("check")
        .filter((check) => check.status === "running" && check.watchClaimId)
        .map((check) => check.watchClaimId),
    );
    const list = this.claims().map((claim) => this.withSearching(claim));
    return list.filter((claim) => {
      if (scope === "mine") return claim.createdBy === MEMBER_ID;
      if (scope === "watched") return watched.has(claim.id);
      if (scope === "running") return running.has(claim.id);
      if (scope === "ungrouped") return !claim.narrativeId;
      return true;
    });
  }

  private factCheckOf(claim: TrackedClaim): FactCheck | undefined {
    const report = this.db.get<StoredReport>("report", claim.latestCheckId)?.report;
    return report?.factChecks.find((factCheck) => factCheck.id === claim.factCheckId);
  }

  // ---------- слежение ----------

  private watches(): Watch[] {
    return this.db.list<Watch>("watch").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listWatches(): Array<Watch & { claim: TrackedClaim }> {
    return this.watches().flatMap((watch) => {
      const claim = this.db.get<TrackedClaim>("claim", watch.claimId);
      return claim ? [{ ...watch, claim }] : [];
    });
  }

  private activeWatches(): Watch[] {
    return this.watches().filter((watch) => watch.status !== "finished");
  }

  createWatch(request: CreateWatchRequest): Watch {
    const claim = this.db.get<TrackedClaim>("claim", request.claimId);
    if (!claim) throw new OrgError(404, "NOT_FOUND", "утверждение не найдено");
    const existing = this.watches().find((watch) => watch.claimId === claim.id);
    if (!existing && this.activeWatches().length >= this.options.watches) {
      throw new OrgError(429, "WATCH_LIMIT", "лимит слежений исчерпан");
    }
    if (!request.signals?.length) throw new OrgError(400, "BAD_REQUEST", "нужен хотя бы один сигнал");
    const now = this.now();
    return this.db.put<Watch>("watch", {
      id: existing?.id ?? randomUUID(),
      organizationId: ORGANIZATION_ID,
      claimId: claim.id,
      status: "active",
      frequency: request.frequency,
      signals: request.signals,
      until: request.days ? new Date(now.getTime() + request.days * DAY_MS).toISOString() : undefined,
      channels: request.channels,
      createdBy: MEMBER_ID,
      createdAt: existing?.createdAt ?? now.toISOString(),
      lastCheckAt: existing?.lastCheckAt,
      lastNewAt: existing?.lastNewAt ?? now.toISOString(),
      fresh: existing?.fresh ?? 0,
    });
  }

  updateWatch(
    id: string,
    patch: Partial<Pick<Watch, "status" | "frequency" | "signals" | "channels">>,
  ): Watch {
    const watch = this.db.get<Watch>("watch", id);
    if (!watch) throw new OrgError(404, "NOT_FOUND", "слежение не найдено");
    return this.db.put("watch", { ...watch, ...patch });
  }

  deleteWatch(id: string): void {
    this.db.remove("watch", id);
  }

  checkWatchNow(id: string): ClaimCheck {
    const watch = this.db.get<Watch>("watch", id);
    if (!watch) throw new OrgError(404, "NOT_FOUND", "слежение не найдено");
    const claim = this.db.get<TrackedClaim>("claim", watch.claimId);
    if (!claim) throw new OrgError(404, "NOT_FOUND", "утверждение не найдено");
    const latest = this.db.get<ClaimCheck>("check", claim.latestCheckId);
    return this.startCheck(claim.text, claim.id, latest?.locale);
  }

  /** Плановый проход: что пора перепроверить. Упёрлись в лимит — остальное подождёт следующего месяца */
  tick(): ClaimCheck[] {
    const now = this.now();
    const started: ClaimCheck[] = [];
    for (const watch of this.watches()) {
      if (watch.status !== "active") continue;
      if (watch.until && new Date(watch.until) <= now) {
        this.db.put("watch", { ...watch, status: "finished" });
        continue;
      }
      const last = watch.lastCheckAt ?? watch.createdAt;
      if (daysBetween(last, now) < FREQUENCY_DAYS[watch.frequency]) continue;
      try {
        started.push(this.checkWatchNow(watch.id));
      } catch (err) {
        if (err instanceof OrgError && err.code === "CHECK_LIMIT") break;
        throw err;
      }
    }
    return started;
  }

  private finishWatchCheck(check: ClaimCheck, usable: FactCheck[]): void {
    const claim = this.db.get<TrackedClaim>("claim", check.watchClaimId ?? "");
    if (!claim) return;
    check.claimIds = [claim.id];
    const key = normalize(claim.text);
    const after = usable.find((factCheck) => normalize(factCheck.claim) === key) ?? usable[0];
    if (!after) return;
    const before = this.factCheckOf(claim);
    const watch = this.watches().find((item) => item.claimId === claim.id);
    const now = this.now();
    const signals = before && watch ? this.signalsFor(watch, claim, before, after) : [];
    const freshCount = signals.find((signal) => signal.type === "new_publications")?.params.count ?? 0;

    if (watch) {
      const alerts = signals
        .filter((signal) => watch.signals.includes(signal.type) && !this.sentToday(watch, signal))
        .map((signal) => this.createAlert(watch, claim, check, signal));
      this.db.put<Watch>("watch", {
        ...watch,
        lastCheckAt: now.toISOString(),
        lastNewAt: freshCount > 0 ? now.toISOString() : watch.lastNewAt,
        fresh: watch.fresh + freshCount,
      });
      for (const alert of alerts) this.emit({ type: "alert.created", alert });
    }

    this.db.put<TrackedClaim>("claim", {
      ...claim,
      latestCheckId: check.id,
      factCheckId: after.id,
      checksCount: claim.checksCount + 1,
      lastCheckAt: now.toISOString(),
      status: nextStatus(signals, claim, after, watch, now),
      sides: sidesOf(after),
    });
  }

  private signalsFor(watch: Watch, claim: TrackedClaim, before: FactCheck, after: FactCheck): Signal[] {
    const now = this.now();
    const known = (before.provenance?.nodes ?? []).filter(
      (node) => node.isoDate && daysBetween(node.isoDate, now) <= USUAL_WINDOW_DAYS,
    ).length;
    const signals = compareChecks({
      before,
      after,
      since: claim.lastCheckAt,
      days: daysBetween(claim.lastCheckAt, now),
      usualPerDay: known / USUAL_WINDOW_DAYS,
      bigOutlets: this.options.bigOutlets,
    });
    const hasNew = signals.some((signal) => signal.type === "new_publications");
    if (!hasNew && isQuiet(watch.lastNewAt, now)) {
      signals.push({ type: "quiet", importance: "info", params: {}, nodeIds: [] });
    }
    return signals;
  }

  /** Один сигнал по одному утверждению — не чаще раза в сутки */
  private sentToday(watch: Watch, signal: Signal): boolean {
    const now = this.now().getTime();
    return this.alerts().some(
      (alert) =>
        alert.watchId === watch.id &&
        alert.type === signal.type &&
        now - new Date(alert.createdAt).getTime() < DAY_MS,
    );
  }

  private createAlert(watch: Watch, claim: TrackedClaim, check: ClaimCheck, signal: Signal): Alert {
    return this.db.put<Alert>("alert", {
      id: randomUUID(),
      organizationId: ORGANIZATION_ID,
      watchId: watch.id,
      claimId: claim.id,
      claimText: claim.text,
      checkId: check.id,
      type: signal.type,
      importance: signal.importance,
      params: signal.params,
      nodeIds: signal.nodeIds,
      createdAt: this.now().toISOString(),
    });
  }

  // ---------- уведомления ----------

  alerts(): Alert[] {
    return this.db.list<Alert>("alert").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  readAlert(id: string): Alert {
    const alert = this.db.get<Alert>("alert", id);
    if (!alert) throw new OrgError(404, "NOT_FOUND", "уведомление не найдено");
    const watch = this.db.get<Watch>("watch", alert.watchId);
    if (watch) this.db.put("watch", { ...watch, fresh: 0 });
    return this.db.put("alert", { ...alert, readAt: alert.readAt ?? this.now().toISOString() });
  }

  // ---------- нарративы ----------

  private narratives(): Narrative[] {
    return this.db.list<Narrative>("narrative").sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
  }

  listNarratives(): Narrative[] {
    return this.narratives();
  }

  private quotesOf(claimIds: string[]): NarrativeQuote[] {
    const seen = new Set<string>();
    const quotes: NarrativeQuote[] = [];
    for (const id of claimIds) {
      const claim = this.db.get<TrackedClaim>("claim", id);
      const nodes = (claim && this.factCheckOf(claim)?.provenance?.nodes) || [];
      for (const node of nodes
        .filter((item) => item.role !== "target" && item.url && item.quote)
        .slice(0, QUOTES_PER_CLAIM)) {
        if (seen.has(node.url!)) continue;
        seen.add(node.url!);
        quotes.push({ url: node.url, site: node.name, date: node.date, text: node.quote });
      }
    }
    return quotes.slice(0, MAX_NARRATIVE_QUOTES);
  }

  private assignClaims(narrativeId: string, claimIds: string[]): void {
    for (const id of claimIds) {
      const claim = this.db.get<TrackedClaim>("claim", id);
      if (!claim) throw new OrgError(404, "NOT_FOUND", "утверждение не найдено");
      const previous = claim.narrativeId && this.db.get<Narrative>("narrative", claim.narrativeId);
      if (previous && previous.id !== narrativeId) {
        const rest = previous.claimIds.filter((item) => item !== id);
        this.db.put("narrative", { ...previous, claimIds: rest, quotes: this.quotesOf(rest) });
      }
      this.db.put("claim", { ...claim, narrativeId });
    }
  }

  createNarrative(request: CreateNarrativeRequest): Narrative {
    const title = request.title?.trim();
    if (!title) throw new OrgError(400, "BAD_REQUEST", "нужно название");
    if (!request.claimIds?.length) throw new OrgError(400, "BAD_REQUEST", "нужен хотя бы один вопрос");
    const id = randomUUID();
    this.assignClaims(id, request.claimIds);
    const narrative = this.db.put<Narrative>("narrative", {
      id,
      organizationId: ORGANIZATION_ID,
      title,
      description: request.description?.trim() ?? "",
      claimIds: request.claimIds,
      quotes: this.quotesOf(request.claimIds),
      confirmedBy: this.options.memberName,
      confirmedAt: this.now().toISOString(),
    });
    if (request.suggestionId) this.setSuggestion(request.suggestionId, "accepted");
    this.refreshSuggestions();
    return narrative;
  }

  addToNarrative(id: string, claimIds: string[]): Narrative {
    const narrative = this.db.get<Narrative>("narrative", id);
    if (!narrative) throw new OrgError(404, "NOT_FOUND", "нарратив не найден");
    this.assignClaims(id, claimIds);
    const all = [...new Set([...narrative.claimIds, ...claimIds])];
    this.refreshSuggestions();
    return this.db.put("narrative", { ...narrative, claimIds: all, quotes: this.quotesOf(all) });
  }

  /** Вопрос остаётся в кабинете, уходит только из нарратива */
  removeFromNarrative(id: string, claimId: string): Narrative {
    const narrative = this.db.get<Narrative>("narrative", id);
    if (!narrative) throw new OrgError(404, "NOT_FOUND", "нарратив не найден");
    const claim = this.db.get<TrackedClaim>("claim", claimId);
    if (claim?.narrativeId === id) this.db.put("claim", { ...claim, narrativeId: undefined });
    const rest = narrative.claimIds.filter((item) => item !== claimId);
    const updated = this.db.put("narrative", { ...narrative, claimIds: rest, quotes: this.quotesOf(rest) });
    this.refreshSuggestions();
    return updated;
  }

  getNarrative(id: string): OrgNarrativeDetail {
    const narrative = this.db.get<Narrative>("narrative", id);
    if (!narrative) throw new OrgError(404, "NOT_FOUND", "нарратив не найден");
    const claims = narrative.claimIds.flatMap((claimId) => {
      const claim = this.db.get<TrackedClaim>("claim", claimId);
      return claim ? [this.withSearching(claim)] : [];
    });
    const factChecks = claims.flatMap((claim) => this.factCheckOf(claim) ?? []);
    const urls = new Set(
      factChecks.flatMap((factCheck) =>
        (factCheck.provenance?.nodes ?? []).flatMap((node) => (node.url ? [node.url] : [])),
      ),
    );
    return {
      narrative,
      claims,
      publications: urls.size,
      languages: new Set(
        factChecks.flatMap((factCheck) => factCheck.sources.map((source) => source.language)),
      ).size,
      lastChange: claims
        .map((claim) => claim.lastCheckAt)
        .sort()
        .at(-1),
    };
  }

  // ---------- предложения групп ----------

  private suggestions(): NarrativeSuggestion[] {
    return this.db.list<NarrativeSuggestion>("suggestion");
  }

  private setSuggestion(id: string, status: NarrativeSuggestion["status"]): void {
    const suggestion = this.db.get<NarrativeSuggestion>("suggestion", id);
    if (!suggestion) throw new OrgError(404, "NOT_FOUND", "предложение не найдено");
    this.db.put("suggestion", { ...suggestion, status });
  }

  dismissSuggestion(id: string): void {
    this.setSuggestion(id, "dismissed");
  }

  /** Пересчёт по утверждениям без группы. Отклонённая группа с тем же составом больше не предлагается */
  private refreshSuggestions(): void {
    const items = this.claims().flatMap((claim) => {
      const factCheck = claim.narrativeId ? undefined : this.factCheckOf(claim);
      return factCheck ? [{ claimId: claim.id, factCheck }] : [];
    });
    const groups = suggestGroups(items);
    const ids = new Set<string>();
    for (const group of groups) {
      const id = createHash("sha256").update(group.claimIds.join("|")).digest("hex").slice(0, 16);
      ids.add(id);
      const known = this.db.get<NarrativeSuggestion>("suggestion", id);
      this.db.put<NarrativeSuggestion>("suggestion", {
        id,
        organizationId: ORGANIZATION_ID,
        claimIds: group.claimIds,
        quotes: group.quotes,
        status: known?.status ?? "pending",
      });
    }
    for (const suggestion of this.suggestions()) {
      if (suggestion.status === "pending" && !ids.has(suggestion.id))
        this.db.remove("suggestion", suggestion.id);
    }
  }

  // ---------- сессия ----------

  session(): OrgSession {
    const { start, reset } = this.period();
    const counts = {
      all: this.listClaims("all").length,
      mine: this.listClaims("mine").length,
      watched: this.listClaims("watched").length,
      running: this.running().length,
      ungrouped: this.listClaims("ungrouped").length,
      videos: this.videoChecks().length,
    };
    return {
      organization: { id: ORGANIZATION_ID, name: this.options.organizationName },
      member: { id: MEMBER_ID, name: this.options.memberName, role: "member" },
      counts,
      unreadAlerts: this.alerts().filter((alert) => !alert.readAt).length,
      clarifications: this.clarifications(),
      running: this.running(),
      narratives: this.narratives().map(({ id, title, claimIds }) => ({ id, title, count: claimIds.length })),
      suggestions: this.suggestions()
        .filter((suggestion) => suggestion.status === "pending")
        .map((suggestion) => ({
          ...suggestion,
          claims: suggestion.claimIds.flatMap((id) => {
            const claim = this.db.get<TrackedClaim>("claim", id);
            return claim ? [{ id, text: claim.text }] : [];
          }),
        })),
      limits: {
        periodStart: start.toISOString(),
        resetAt: reset.toISOString(),
        checksUsed: this.checksUsed(),
        checksTotal: this.options.checksPerMonth,
        watchesUsed: this.activeWatches().length,
        watchesTotal: this.options.watches,
      },
    };
  }
}

function setStep(
  steps: OrgSearchStep[],
  key: OrgStepKey,
  status: OrgSearchStep["status"],
  found?: number,
): boolean {
  const step = steps.find((item) => item.key === key);
  if (!step || (step.status === status && (found === undefined || step.found === found))) return false;
  step.status = status;
  if (found !== undefined) step.found = found;
  return true;
}

/** Событие пайплайна → шаги «Хода поиска». true — что-то изменилось */
function applyStep(steps: OrgSearchStep[], event: ServerEvent): boolean {
  if (event.type === "claim.detected") {
    const found =
      (steps.find((step) => step.key === "claims")?.found ?? 0) +
      (event.factCheck.status === "found" ? 1 : 0);
    return setStep(steps, "claims", "done", found);
  }
  if (event.type !== "claim.progress") return false;
  if (event.stage === "source_search") {
    return [setStep(steps, "search", "running"), setStep(steps, "traces", "running")].some(Boolean);
  }
  if (event.stage === "provenance") {
    return [
      setStep(steps, "search", "done", event.sourcesFound),
      setStep(steps, "traces", "done"),
      setStep(steps, "tree", "running"),
    ].some(Boolean);
  }
  return [setStep(steps, "tree", "done"), setStep(steps, "stances", "running")].some(Boolean);
}

function nextStatus(
  signals: Signal[],
  claim: TrackedClaim,
  after: FactCheck,
  watch: Watch | undefined,
  now: Date,
): TrackedClaim["status"] {
  const types = new Set(signals.map((signal) => signal.type));
  const hasDebunk = (after.provenance?.nodes ?? []).some(
    (node) => node.category === "fact_checker" || node.categoryLabel === "разбор",
  );
  if (types.has("growth") || types.has("new_publications"))
    return hasDebunk && !types.has("growth") ? "debunked" : "spreading";
  if (hasDebunk) return "debunked";
  if (watch && isQuiet(watch.lastNewAt, now)) return "fading";
  return claim.status === "new" ? "stable" : claim.status === "spreading" ? "stable" : claim.status;
}
