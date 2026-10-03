/** Даты этапа 07 и слова относительного времени («вчера», «недавно»): всё в UTC, сутки начинаются в 00:00Z. */

export const DAY_MS = 86_400_000;

export type DatePrecision = "year" | "month" | "day";

/** ISO-строка → миллисекунды; нет или не разбирается — null */
export function parseTime(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** "2026-10-01T00:00:00Z" — как в моках, без миллисекунд */
export function toIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ===================== ОТНОСИТЕЛЬНОЕ ВРЕМЯ =====================

export type RelativeWord = "just_now" | "now" | "today" | "yesterday" | "this_week" | "recently";

/** Начало слова (не середина: «позавчера» — не «вчера», «alaltăieri» — не «ieri») */
const B = "(?<![\\p{L}\\p{N}])";
/** Конец слова */
const E = "(?![\\p{L}\\p{N}])";

/**
 * Слова относительного времени (ru / ro / en) — в порядке «свежести»; «acum» без срока после него
 * («acum 3 ani» — «три года назад»).
 */
const RELATIVE_WORDS: Array<[RelativeWord, RegExp]> = [
  ["just_now", new RegExp(`${B}(?:только что|just now)${E}`, "u")],
  [
    "now",
    new RegExp(
      `${B}(?:сейчас|now|currently|în prezent|in prezent|acum${E}(?!\\s+(?:\\d+|o|un|una|doi|două|doua|trei|câteva|cateva|câțiva|cativa|mai|zeci|ani|luni|zile)${E}))${E}`,
      "u",
    ),
  ],
  ["today", new RegExp(`${B}(?:сегодня\\p{L}*|today|azi|astăzi|astazi)${E}`, "u")],
  ["yesterday", new RegExp(`${B}(?:вчера\\p{L}*|yesterday|ieri)${E}`, "u")],
  [
    "this_week",
    new RegExp(
      `${B}(?:на этой неделе|this week|săptămâna aceasta|saptamana aceasta|săptămâna asta)${E}`,
      "u",
    ),
  ],
  ["recently", new RegExp(`${B}(?:недавн\\p{L}*|на днях|recent\\p{L}*|lately)${E}`, "u")],
];

/**
 * Самое «свежее» слово относительного времени в ClaimStructure.time.text: «сейчас» / «azi» / «today»,
 * «вчера» / «ieri», «недавно» / «săptămâna aceasta» / «recently». Не узнано — null.
 */
export function relativeWord(text: string): RelativeWord | null {
  const s = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/ş/g, "ș")
    .replace(/ţ/g, "ț")
    .replace(/\s+/g, " ")
    .trim();
  return RELATIVE_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;
}

// ===================== ДАТЫ =====================

/**
 * Дата события из ClaimStructure.time.date: "2022" → 1 января 2022, "2022-02" → 1 февраля,
 * "2022-02-24" (можно со временем после T) → этот день. Несуществующая дата ("2022-13", "2022-02-30") — null.
 */
export function parseEventDate(date: string): { at: number; precision: DatePrecision } | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T.*)?)?)?$/.exec(date.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 1;
  const day = m[3] ? Number(m[3]) : 1;
  const at = Date.UTC(year, month - 1, day);
  const d = new Date(at);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { at, precision: m[3] ? "day" : m[2] ? "month" : "year" };
}

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_PREPOSITIONAL = [
  "январе",
  "феврале",
  "марте",
  "апреле",
  "мае",
  "июне",
  "июле",
  "августе",
  "сентябре",
  "октябре",
  "ноябре",
  "декабре",
];

/** «14 января 2021» */
export function formatDayRu(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Когда, с точностью явной даты: «24 февраля 2022» / «в феврале 2022» / «в 2022 году» */
export function formatPeriodRu(ms: number, precision: DatePrecision): string {
  const d = new Date(ms);
  if (precision === "year") return `в ${d.getUTCFullYear()} году`;
  if (precision === "month") return `в ${MONTHS_PREPOSITIONAL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return formatDayRu(ms);
}
