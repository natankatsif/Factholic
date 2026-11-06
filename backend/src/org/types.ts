/**
 * API кабинета для организаций: /api/org/*. Смысл полей — obsidian/13_Кабинет_структур_Контракт.md.
 * Тексты на экране здесь не передаются: уведомление — это вид и параметры, подпись строит фронт из словаря.
 * Лежит в бэкенде, а не в packages/contracts: тот пакет меняется только по договорённости всех троих.
 * Сайт импортирует отсюда только типы. Когда команда согласует, файл переезжает в контракты без изменений.
 */
import type { ClaimId, ISODateString, JobId, VideoReport } from "@news/contracts";
import type { SearchActivity } from "../pipeline/context.ts";

export type OrgClaimStatus =
  | "checking"
  | "new"
  | "spreading"
  | "stable"
  | "debunked"
  | "fading"
  | "outdated"
  | "inflated"
  | "against"
  | "split"
  | "converging"
  | "few";
export type OrgCheckStatus = "running" | "done" | "failed";
export type OrgStepKey = "claims" | "search" | "traces" | "tree" | "stances" | "done";
export type OrgStepStatus = "waiting" | "running" | "done" | "failed";
export type OrgWatchStatus = "active" | "paused" | "finished";
export type OrgWatchFrequency = "daily" | "weekly";
export type OrgWatchChannel = "cabinet" | "email";
export type OrgClaimScope = "all" | "mine" | "watched" | "running" | "ungrouped";
export type OrgSignal =
  | "new_publications"
  | "growth"
  | "new_language"
  | "new_outlet"
  | "changed_detail"
  | "debunk_found"
  | "sides_changed"
  | "earlier_found"
  | "quiet";
export type OrgAlertImportance = "info" | "notable" | "urgent";

export const ORG_SIGNALS: OrgSignal[] = [
  "new_publications",
  "growth",
  "new_language",
  "new_outlet",
  "changed_detail",
  "debunk_found",
  "sides_changed",
  "earlier_found",
  "quiet",
];

export interface OrgPlan {
  checksPerMonth: number;
  watches: number;
}

export interface OrgSearchStep {
  key: OrgStepKey;
  status: OrgStepStatus;
  found?: number;
}

export interface OrgSides {
  for: number;
  against: number;
  partial: number;
  neutral: number;
}

/** Сохранённое утверждение организации */
export interface TrackedClaim {
  id: string;
  organizationId: string;
  text: string;
  quote: string;
  language: string;
  sourceUrl?: string;
  createdBy: string;
  createdByName: string;
  createdAt: ISODateString;
  latestCheckId: string;
  /** Утверждение в отчёте последней проверки */
  factCheckId: ClaimId;
  status: OrgClaimStatus;
  checksCount: number;
  lastCheckAt: ISODateString;
  narrativeId?: string;
  sides?: OrgSides;
  /** Идёт повторный поиск. Считается при выдаче, в базе не хранится */
  searching?: boolean;
}

/** Вопрос модели перед проверкой: ждёт ответа сотрудника */
export interface Clarification {
  id: string;
  organizationId: string;
  input: string;
  question: string;
  rewritten: string;
  /** В тексте несколько утверждений: сотрудник выбирает одно, и вопроса о формулировке нет */
  options?: string[];
  /** Язык интерфейса: на нём написан вопрос и пойдут тексты отчёта */
  locale: string;
  status: "pending" | "answered";
  createdAt: ISODateString;
}

export type ClarificationAnswer = "yes" | "no" | "other";

/** POST /api/org/checks: либо проверка началась, либо сначала нужен ответ */
export type StartCheckResponse = { check: ClaimCheck } | { clarification: Clarification };

/** Один запуск поиска и построения дерева */
export interface ClaimCheck {
  id: string;
  organizationId: string;
  input: string;
  locale: string;
  status: OrgCheckStatus;
  jobId: JobId;
  steps: OrgSearchStep[];
  claimIds: string[];
  /** Проверка слежения: какое утверждение перепроверяли */
  watchClaimId?: string;
  /** Сколько раз нажали «Найти ещё»: каждый поиск платный и считается в лимит */
  moreSearches?: number;
  /** Чем закончился последний такой поиск */
  lastMore?: { found: number; at: ISODateString };
  createdBy: string;
  startedAt: ISODateString;
  finishedAt?: ISODateString;
  /** В тексте нет проверяемых утверждений */
  noClaims?: boolean;
  /**
   * Видео: живёт отдельным списком, утверждения в общие вопросы не попадают. Разбор на утверждения считается
   * проверкой целиком, а сами утверждения проверяются по ходу просмотра: текущее и ближайшие
   */
  kind?: "video" | "article";
}

/** GET /api/org/videos: видео организации */
export interface OrgVideo {
  id: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  durationSec: number;
  status: OrgCheckStatus;
  claims: number;
  checked: number;
  startedAt: ISODateString;
  kind: "video" | "article";
}

export interface Watch {
  id: string;
  organizationId: string;
  claimId: string;
  status: OrgWatchStatus;
  frequency: OrgWatchFrequency;
  signals: OrgSignal[];
  /** Пусто — пока не выключат */
  until?: ISODateString;
  channels: OrgWatchChannel[];
  createdBy: string;
  createdAt: ISODateString;
  lastCheckAt?: ISODateString;
  /** Когда в последний раз находились новые публикации */
  lastNewAt: ISODateString;
  /** Сколько новых публикаций с прошлого просмотра */
  fresh: number;
}

export interface AlertPublication {
  nodeId: string;
  name: string;
  date: string;
  url?: string;
}

/** Параметры для подписи: какие заполнены, зависит от вида сигнала */
export interface AlertParams {
  count?: number;
  usual?: number;
  language?: string;
  outlet?: string;
  date?: string;
  before?: string;
  after?: string;
  publications?: AlertPublication[];
  parentNodeId?: string;
}

export interface Alert {
  id: string;
  organizationId: string;
  watchId: string;
  claimId: string;
  claimText: string;
  checkId: string;
  type: OrgSignal;
  importance: OrgAlertImportance;
  params: AlertParams;
  nodeIds: string[];
  createdAt: ISODateString;
  readAt?: ISODateString;
}

export interface NarrativeQuote {
  url?: string;
  site: string;
  date: string;
  /** Дата для показа на языке интерфейса */
  isoDate?: ISODateString;
  text: string;
  /** Появилась после последнего поиска по слежению */
  fresh?: boolean;
}

export interface Narrative {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  claimIds: string[];
  quotes: NarrativeQuote[];
  confirmedBy: string;
  confirmedAt: ISODateString;
}

export interface NarrativeSuggestion {
  id: string;
  organizationId: string;
  claimIds: string[];
  quotes: NarrativeQuote[];
  status: "pending" | "accepted" | "dismissed";
}

export interface OrgRunningCheck {
  id: string;
  claim: string;
  step: number;
  totalSteps: number;
  stepKey: OrgStepKey;
  found: number;
  kind?: ClaimCheck["kind"];
}

export interface OrgSession {
  organization: { id: string; name: string };
  member: { id: string; name: string; role: "member" | "admin" };
  counts: Record<OrgClaimScope | "videos" | "links", number>;
  unreadAlerts: number;
  clarifications: Clarification[];
  running: OrgRunningCheck[];
  narratives: Array<{ id: string; title: string; count: number }>;
  suggestions: Array<NarrativeSuggestion & { claims: Array<{ id: string; text: string }> }>;
  limits: {
    periodStart: ISODateString;
    resetAt: ISODateString;
    checksUsed: number;
    checksTotal: number;
    watchesUsed: number;
    watchesTotal: number;
  };
}

/** GET /api/org/checks/:id */
export interface OrgCheckDetail {
  check: ClaimCheck;
  report: VideoReport | null;
  claims: TrackedClaim[];
  watches: Watch[];
  alerts: Alert[];
  /** Для каких утверждений отчёта сейчас идёт «Найти ещё» */
  searchingMore: string[];
  /** Что поиск уже сделал: запросы, отбор страниц, связи */
  activity: SearchActivity[];
}

/** GET /api/org/narratives/:id */
export interface OrgNarrativeDetail {
  narrative: Narrative;
  claims: TrackedClaim[];
  /** Слежения за вопросами нарратива */
  watches: Watch[];
  publications: number;
  languages: number;
  lastChange?: ISODateString;
}

export interface CreateWatchRequest {
  claimId: string;
  frequency: OrgWatchFrequency;
  signals: OrgSignal[];
  /** Дней слежения; пусто — пока не выключат */
  days?: number;
  channels: OrgWatchChannel[];
}

export interface CreateNarrativeRequest {
  title: string;
  description: string;
  claimIds: string[];
  suggestionId?: string;
}

export interface OrgApiError {
  error: string;
  code: "NOT_FOUND" | "BAD_REQUEST" | "CHECK_LIMIT" | "WATCH_LIMIT" | "RATE_LIMITED";
}

/** WS /api/org/events */
export type OrgEvent =
  | { type: "check.step"; checkId: string }
  | { type: "check.finished"; checkId: string }
  | { type: "check.failed"; checkId: string }
  | { type: "alert.created"; alert: Alert };

export type { SearchActivity };
