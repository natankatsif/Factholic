import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import { VIDEO_NODE_ID } from "../05-provenance/types.ts";
import {
  DAY_MS,
  formatDayRu,
  formatPeriodRu,
  parseEventDate,
  parseTime,
  relativeWord,
  startOfUtcDay,
  toIso,
  type DatePrecision,
  type RelativeWord,
} from "./dates.ts";
import type { OldContentFlag, RootDateInput, RootDateOutput } from "./types.ts";

export type * from "./types.ts";

// ===================== ПРАВИЛА =====================

/** На сколько дней раньше даты видео (или момента анализа) слово относит событие */
const RELATIVE_OFFSET_DAYS: Record<RelativeWord, number> = {
  just_now: 0,
  now: 0,
  today: 0,
  yesterday: 1,
  this_week: 7,
  recently: 7,
};

/**
 * Допуск: насколько корень может быть раньше заявленной даты, чтобы это ещё не было «старым контентом»
 * (новость выходит не сразу, «вчера» в видео могли записать на день-два раньше публикации).
 */
const RELATIVE_TOLERANCE_DAYS = 3;
/** «на этой неделе» / «недавно» — размытее, допуск больше */
const VAGUE_TOLERANCE_DAYS = 14;
const VAGUE_WORDS: RelativeWord[] = ["this_week", "recently"];

/** Допуск для явной даты («24 февраля 2022») — она точнее относительного времени */
const EXPLICIT_DATE_TOLERANCE_DAYS = 2;

/** Как слово звучит в note: «…а в видео это подано как вчерашнее событие» */
const RELATIVE_PHRASE: Record<RelativeWord, string> = {
  just_now: "как только что случившееся",
  now: "как происходящее сейчас",
  today: "как сегодняшнее событие",
  yesterday: "как вчерашнее событие",
  this_week: "как событие этой недели",
  recently: "как недавнее событие",
};

// ===================== ЭТАП =====================

/** Какую дату события заявляет видео и откуда она взялась */
type Claimed =
  | { kind: "date"; at: number; precision: DatePrecision }
  | {
      kind: "relative";
      at: number;
      precision: DatePrecision;
      /** Как сказано в видео: «вчера», «на днях» */
      text: string;
      /** Узнанное слово; null — дату посчитал этап 03, а слово нам незнакомо («позавчера») */
      word: RelativeWord | null;
      /** Дата посчитана здесь по слову (а не взята из time.date) — это лишь нижняя граница для «недавно» */
      estimated: boolean;
    };

/**
 * Чистая функция без внешних API — не переключается mock/real (как 09-report).
 *  1. claimedAt: structure.time.date (начало года / месяца / дня); если даты нет, но время относительное —
 *     по словам time.text («сейчас», «вчера», «недавно»; ru / ro / en) от videoPublishedAt (нет — от now,
 *     нет — от текущего времени), начало суток UTC. Слова не узнаны — null.
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
    if (claimed.at - rootMs > toleranceDays(claimed) * DAY_MS) {
      flag = { type: "old_content", rootPublishedAt, claimedAt, note: oldContentNote(rootMs, claimed) };
    }
  }

  return { claimId: claim.id, claimedAt, rootPublishedAt, flag };
}

function claimedTime(structure: ClaimStructure, anchor: () => number): Claimed | null {
  const time = structure.time;
  if (!time) return null;
  const explicit = time.date ? parseEventDate(time.date) : null;
  if (!time.relative) return explicit ? { kind: "date", ...explicit } : null;

  const text = time.text.trim();
  const word = relativeWord(text);
  if (explicit) return { kind: "relative", ...explicit, text, word, estimated: false };
  if (!word) return null;
  const at = anchor() - RELATIVE_OFFSET_DAYS[word] * DAY_MS;
  return { kind: "relative", at, precision: "day", text, word, estimated: true };
}

function toleranceDays(claimed: Claimed): number {
  if (claimed.kind === "date") return EXPLICIT_DATE_TOLERANCE_DAYS;
  return claimed.word && VAGUE_WORDS.includes(claimed.word) ? VAGUE_TOLERANCE_DAYS : RELATIVE_TOLERANCE_DAYS;
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
  const phrase = claimed.word
    ? RELATIVE_PHRASE[claimed.word]
    : claimed.text
      ? `словами «${claimed.text}»`
      : RELATIVE_PHRASE.recently;
  // «на этой неделе» / «недавно», посчитанные по слову, — заявленная дата лишь нижняя граница
  const fuzzy =
    claimed.estimated && claimed.word && RELATIVE_OFFSET_DAYS[claimed.word] > 1 ? "не раньше " : "";
  return `${root}, а в видео это подано ${phrase} (${fuzzy}${formatPeriodRu(claimed.at, claimed.precision)}).`;
}
