/**
 * Данные экранов кабинета. Названия полей и значений — из obsidian/13_Кабинет_структур_Контракт.md.
 * API пока нет, поэтому даты уже приходят подписями. Когда API появится, подписи будет строить фронт.
 */

export type ClaimStatus = "new" | "spreading" | "stable" | "debunked" | "fading";
export type CheckStatus = "running" | "done" | "failed";
export type Stance = "for" | "against" | "partial" | "neutral";
export type OutletType = "media" | "channel" | "official" | "debunk";
export type StepKey = "claims" | "search" | "traces" | "tree" | "stances" | "done";
export type StepStatus = "waiting" | "running" | "done" | "failed";
export type WatchStatus = "active" | "paused" | "finished";
export type WatchFrequency = "daily" | "weekly";
export type WatchDuration = "d7" | "d30" | "forever";
export type WatchChannel = "cabinet" | "email";
export type SignalType =
  | "new_publications"
  | "growth"
  | "new_language"
  | "new_outlet"
  | "changed_detail"
  | "debunk_found"
  | "sides_changed"
  | "earlier_found"
  | "quiet";
export type ClaimScope = "all" | "mine" | "watched" | "running" | "ungrouped";

export interface SearchStep {
  key: StepKey;
  status: StepStatus;
  found?: number;
}

export interface SidesSummary {
  for: number;
  against: number;
  partial: number;
  neutral: number;
}

export type ChangeKind = "number" | "place" | "time";

export interface DetailChange {
  kind: ChangeKind;
  text: string;
}

export interface PublicationNode {
  id: string;
  kind: "publication";
  role?: "root" | "prehistory" | "debunk";
  outlet: string;
  /** Цвет кружка из палитры дизайна */
  color: string;
  type: OutletType;
  language: string;
  /** Нет даты — подпись «дата не указана» */
  date?: string;
  dateNote?: string;
  quote: string;
  /** Изменения относительно родителя: метка на узле */
  changeLabel?: string;
  stance?: Stance;
  detail?: PublicationDetail;
}

/** Содержимое карточки публикации */
export interface PublicationDetail {
  headline: string;
  fullQuote: string;
  parentName: string;
  change?: DetailChange;
  parentLink: string;
  url: string;
}

export interface MissingNode {
  id: string;
  kind: "missing";
  name: string;
  note: string;
}

export interface CheckedTextNode {
  id: string;
  kind: "checked";
  quote: string;
}

export type TreeNode = PublicationNode | MissingNode | CheckedTextNode;

export type EdgeKind = "confirmed" | "probable" | "changed" | "debunk";

export interface TreeEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  detail?: EdgeDetail;
}

export interface QuoteWord {
  text: string;
  changed?: boolean;
}

export interface EdgeDetail {
  beforeSource: string;
  afterSource: string;
  /** Строки цитаты: слова с подсветкой изменений */
  before: QuoteWord[][];
  after: QuoteWord[][];
  changes: DetailChange[];
  evidence: string;
  fragmentUrl: string;
  /** Связь с проверяемым текстом: только сходство, откуда текст, неизвестно */
  similarOnly?: boolean;
}

export interface UnlinkedPublication {
  id: string;
  outlet: string;
  color: string;
  date: string;
  url?: string;
}

export interface AlertPublication {
  id: string;
  outlet: string;
  color: string;
  date: string;
}

/** Новые публикации на холсте и узел, к которому они относятся */
export interface AlertGroup {
  title: string;
  parentId: string;
  /** Эти публикации показаны в блоке, а не отдельными узлами */
  nodeIds?: string[];
  publications: AlertPublication[];
}

/** Куда ведёт обновление в ленте */
export interface AlertTarget {
  alertId?: string;
  nodeIds?: string[];
  publications?: Array<{ nodeId: string; name: string; date: string }>;
}

export type FeedItem =
  | { type: "claims"; time: string; count: number; options?: string[] }
  | { type: "searching" }
  | {
      type: "result";
      time: string;
      sides: SidesSummary;
      earliest?: { outlet: string; date: string };
      note?: string;
      summary?: string;
    }
  | { type: "offer"; variant: "default" | "few" }
  | ({ type: "alert"; title: string; time: string; text: string } & AlertTarget)
  | ({ type: "debunk"; title: string; time: string; text: string } & AlertTarget)
  | { type: "watch-on"; time: string; text: string }
  | { type: "result-short"; time: string; text: string }
  | { type: "failed" }
  | { type: "saved"; time: string; count: number }
  | { type: "few-sources"; time: string; count: number }
  | { type: "no-publications"; time: string }
  | { type: "root-unknown"; time: string; outlet: string }
  | { type: "root-unknown-plain"; time: string }
  | { type: "not-checked"; time: string; items: string[] };

export interface CheckStats {
  publications: number;
  links?: number;
  confirmedLinks?: number;
  changes?: number;
  traces?: number;
  growth?: number;
}

export interface CheckView {
  id: string;
  claimId?: string;
  status: CheckStatus;
  claimStatus?: ClaimStatus;
  claim: string;
  /** Подпись рядом со статусом */
  timeLabel?: string;
  watchFrequency?: WatchFrequency;
  nodes: TreeNode[];
  edges: TreeEdge[];
  unlinked: UnlinkedPublication[];
  /** Сколько мест ждут следующую публикацию */
  placeholders: number;
  steps?: SearchStep[];
  stats: CheckStats;
  feed: FeedItem[];
  rootUnknown?: boolean;
  alertGroup?: AlertGroup;
  /** Утверждение отчёта, по которому работает «Найти ещё» */
  factCheckId?: string;
  searchingMore?: boolean;
  /** Сколько новых публикаций дал последний такой поиск */
  moreFound?: number;
}

export interface RunningCheck {
  id: string;
  claim: string;
  step: number;
  totalSteps: number;
  message: string;
  found: number;
  /** Разбор видео: открывается в разделе видео */
  video?: boolean;
}

export interface CabinetLimits {
  month: string;
  resetDate: string;
  checksUsed: number;
  checksTotal: number;
  watchesUsed: number;
  watchesTotal: number;
}

export interface NarrativeLink {
  id: string;
  title: string;
  count: number;
}

export interface AlertItem {
  id: string;
  checkId: string;
  claimId: string;
  claim: string;
  title: string;
  text: string;
  time: string;
  unread: boolean;
}

export interface ClarificationView {
  id: string;
  question: string;
  input: string;
  rewritten: string;
}

export interface SuggestionQuote {
  outlet: string;
  date: string;
  text: string;
  url?: string;
}

export interface SuggestionView {
  id: string;
  /** Тема, если её задал человек; система темы не придумывает */
  topic?: string;
  claims: Array<{ id: string; text: string }>;
  quotes: SuggestionQuote[];
}

export interface ClaimScopeRow {
  id: string;
  text: string;
}

export interface WatchForm {
  frequency: WatchFrequency;
  signals: SignalType[];
  duration: WatchDuration;
  channels: WatchChannel[];
}

export interface CabinetSession {
  organization: string;
  memberName: string;
  memberRole: string;
  memberInitial: string;
  unreadAlerts: number;
  alerts: AlertItem[];
  clarifications: ClarificationView[];
  running: RunningCheck[];
  counts: Record<ClaimScope | "videos", number>;
  narratives: NarrativeLink[];
  suggestions: SuggestionView[];
  limits: CabinetLimits;
}

export interface RecentQuestion {
  id: string;
  text: string;
  date: string;
}

export interface HomeView {
  state: "empty" | "limit" | "no-claims";
  input?: string;
  suggestions: string[];
  recent: RecentQuestion[];
}

export interface QuestionRow {
  id: string;
  checkId: string;
  /** Сколько дней назад последняя проверка: для фильтра периода */
  ageDays: number;
  /** Проверка ещё идёт: вопроса пока нет, только текст и шаг */
  runningStep?: string;
  text: string;
  author: string;
  date: string;
  language: string;
  narrative?: string;
  checks: number;
  last: string;
  status: ClaimStatus;
  scopes: ClaimScope[];
  /** Идёт повторный поиск */
  searching?: boolean;
}

export interface WatchRow {
  id: string;
  claimId: string;
  checkId: string;
  text: string;
  claimStatus: ClaimStatus;
  fresh: number;
  last: string;
  status: WatchStatus;
}

export interface NarrativeQuestion {
  id: string;
  checkId: string;
  text: string;
  status: ClaimStatus;
  sides: SidesSummary;
  /** Идёт повторный поиск */
  searching?: boolean;
}

export interface NarrativeQuote {
  id: string;
  outlet: string;
  color: string;
  date: string;
  text: string;
}

export interface NarrativeView {
  id: string;
  title: string;
  status: ClaimStatus;
  description: string;
  confirmedBy: string;
  confirmedAt: string;
  publications: number;
  languages: number;
  lastChange: string;
  questions: NarrativeQuestion[];
  quotes: NarrativeQuote[];
}

/** Что открыто поверх экрана при показе fixture */
export interface OverlayState {
  menuOpen?: boolean;
  runningOpen?: boolean;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  settingsOpen?: boolean;
  searchCollapsed?: boolean;
  /** Подсветить новые публикации, остальное приглушить */
  highlightAlert?: boolean;
  selectedQuestionIds?: string[];
}

/** Строка списка видео */
export interface VideoRow {
  id: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  duration: string;
  status: "running" | "done" | "failed";
  claims: number;
  checked: number;
  date: string;
}
