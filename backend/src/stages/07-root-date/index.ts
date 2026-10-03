import type { ClaimStructure, TimeMarker } from "../03-claim-extraction/types.ts";
import { VIDEO_NODE_ID } from "../05-provenance/types.ts";
import {
  DAY_MS,
  formatDayRu,
  formatPeriodRu,
  parseEventDate,
  parseTime,
  startOfUtcDay,
  toIso,
  type DatePrecision,
} from "./dates.ts";
import type { OldContentFlag, RootDateInput, RootDateOutput } from "./types.ts";

export type * from "./types.ts";

// ===================== ПРАВИЛА =====================

/** На сколько дней раньше даты видео (или момента анализа) маркер относит событие */
const MARKER_OFFSET_DAYS: Record<TimeMarker, number> = {
  just_now: 0,
  today: 0,
  yesterday: 1,
  this_week: 7,
  recently: 7,
};

/**
 * Допуск: насколько корень может быть раньше заявленной даты, чтобы это ещё не было «старым контентом»
 * (новость выходит не сразу, «вчера» в видео могли записать на день-два раньше публикации).
 */
const MARKER_TOLERANCE_DAYS: Record<TimeMarker, number> = {
  just_now: 3,
  today: 3,
  yesterday: 3,
  this_week: 14,
  recently: 14,
};

/** Допуск для явной даты («24 февраля 2022») — она точнее маркеров */
const EXPLICIT_DATE_TOLERANCE_DAYS = 2;

/** При равном сдвиге (just_now / today, this_week / recently) — первый по этому порядку */
const MARKER_ORDER: TimeMarker[] = ["just_now", "today", "yesterday", "this_week", "recently"];

/** Как маркер звучит в note: «…а в видео это подано как вчерашнее событие» */
const MARKER_PHRASE: Record<TimeMarker, string> = {
  just_now: "как только что случившееся",
  today: "как сегодняшнее событие",
  yesterday: "как вчерашнее событие",
  this_week: "как событие этой недели",
  recently: "как недавнее событие",
};

// ===================== ЭТАП =====================

/** Какую дату события заявляет видео и откуда она взялась */
type Claimed =
  { kind: "date"; at: number; precision: DatePrecision } | { kind: "marker"; at: number; marker: TimeMarker };

/**
 * Чистая функция без внешних API — не переключается mock/real (как 09-report).
 *  1. claimedAt: structure.eventTime.date (начало года / месяца / дня), иначе самый «свежий» из timeMarkers
 *     от videoPublishedAt (нет — от now, нет — от текущего времени), начало суток UTC.
 *     Структура — claim.structure, нет — structure узла "video" из дерева; нет и её — claimedAt null.
 *  2. rootPublishedAt: publishedAt узла tree.rootId.
 *  3. flag old_content, если корень раньше claimedAt больше чем на допуск; note — по-русски, с обеими датами.
 */
export function checkRootDate(input: RootDateInput): RootDateOutput {
  const { claim, tree } = input;
  const structure = claim.structure ?? tree.nodes.find((n) => n.id === VIDEO_NODE_ID)?.structure ?? null;
  const claimed = structure ? claimedTime(structure, () => anchorDay(input)) : null;

  const root = tree.rootId === null ? undefined : tree.nodes.find((n) => n.id === tree.rootId);
  const rootMs = parseTime(root?.publishedAt);
  // дата, которую не разобрать, — всё равно что её нет
  const rootPublishedAt = rootMs === null ? null : (root?.publishedAt ?? null);

  const claimedAt = claimed ? toIso(claimed.at) : null;
  let flag: OldContentFlag | null = null;
  if (claimed && claimedAt && rootPublishedAt && rootMs !== null) {
    const toleranceDays =
      claimed.kind === "date" ? EXPLICIT_DATE_TOLERANCE_DAYS : MARKER_TOLERANCE_DAYS[claimed.marker];
    if (claimed.at - rootMs > toleranceDays * DAY_MS) {
      flag = { type: "old_content", rootPublishedAt, claimedAt, note: oldContentNote(rootMs, claimed) };
    }
  }

  return { claimId: claim.id, claimedAt, rootPublishedAt, flag };
}

function claimedTime(structure: ClaimStructure, anchor: () => number): Claimed | null {
  const explicit = structure.eventTime?.date ? parseEventDate(structure.eventTime.date) : null;
  if (explicit) return { kind: "date", ...explicit };

  const marker = freshestMarker(structure.timeMarkers);
  if (!marker) return null;
  return { kind: "marker", marker, at: anchor() - MARKER_OFFSET_DAYS[marker] * DAY_MS };
}

/** Самый «свежий» маркер — с наименьшим сдвигом назад */
function freshestMarker(markers: TimeMarker[]): TimeMarker | null {
  let best: TimeMarker | null = null;
  for (const m of MARKER_ORDER) {
    if (!markers.includes(m)) continue;
    if (best === null || MARKER_OFFSET_DAYS[m] < MARKER_OFFSET_DAYS[best]) best = m;
  }
  return best;
}

/** Начало суток (UTC), от которых считаются «сегодня» / «вчера» */
function anchorDay(input: RootDateInput): number {
  return startOfUtcDay(parseTime(input.videoPublishedAt) ?? parseTime(input.now) ?? Date.now());
}

/**
 * «Первая публикация — 14 января 2021, а в видео это подано как вчерашнее событие (1 октября 2026).»
 * «Первая публикация — 14 января 2021, а по словам видео событие произошло в декабре 2024.»
 */
function oldContentNote(rootMs: number, claimed: Claimed): string {
  const root = `Первая публикация — ${formatDayRu(rootMs)}`;
  if (claimed.kind === "date") {
    return `${root}, а по словам видео событие произошло ${formatPeriodRu(claimed.at, claimed.precision)}.`;
  }
  // «на этой неделе» / «недавно» — заявленная дата лишь нижняя граница
  const fuzzy = MARKER_OFFSET_DAYS[claimed.marker] > 1 ? "не раньше " : "";
  return `${root}, а в видео это подано ${MARKER_PHRASE[claimed.marker]} (${fuzzy}${formatDayRu(claimed.at)}).`;
}
