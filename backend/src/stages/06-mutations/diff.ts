/**
 * Предфильтр мутаций кодом: сравнивает структуру утверждения у родителя и потомка по полям и выдаёт
 * кандидатов — что и в какую сторону изменилось. Чистые функции без внешних API.
 * Кандидаты потом подтверждает или отклоняет LLM (real.ts): код не знает, что «Кишинёв» и «столица Молдовы» —
 * одно место, а «полмиллиона» и «500 тысяч» — одно число.
 */
import type { ISODateString, LanguageCode } from "@news/contracts";
import type { ClaimNumber, ClaimStructure, TimeMarker } from "../03-claim-extraction/types.ts";
import { formatDay, textsFor } from "./texts.ts";
import type { ClaimMutation } from "./types.ts";

// ===================== ПРАВИЛА =====================

/** Число изменилось больше чем на эту долю от числа у родителя — раздули / преуменьшили; иначе то же самое */
export const NUMBER_CHANGE_THRESHOLD = 0.1;

/** Сутки события у родителя и потомка расходятся больше чем на столько — время изменилось */
export const TIME_TOLERANCE_DAYS = 1;

/** Какие сутки заявляет маркер относительно даты публикации: [от, до] дней назад */
const MARKER_DAYS_BACK: Record<TimeMarker, [number, number]> = {
  just_now: [0, 0],
  today: [0, 0],
  yesterday: [1, 1],
  this_week: [7, 0],
  recently: [7, 0],
};

/** Самый «свежий» маркер — первый из списка, который есть у узла */
const MARKER_ORDER: TimeMarker[] = ["just_now", "today", "yesterday", "this_week", "recently"];

// ===================== ТИПЫ =====================

type Direction = ClaimMutation["direction"];

/** Кандидат в мутацию — ClaimMutation без узлов и note */
export type MutationCandidate = Pick<ClaimMutation, "field" | "before" | "after" | "direction">;

/** Узел дерева глазами сравнения: структура и то, что нужно, чтобы её понять */
export interface DiffSide {
  structure: ClaimStructure;
  /** От неё считаются «сегодня» / «вчера» узла */
  publishedAt?: ISODateString;
  /** Издатель и домен: потомок, сославшийся на родителя («по данным DW»), — не мутация атрибуции */
  publisher?: string;
  domain?: string;
}

// ===================== СРАВНЕНИЕ =====================

/** Все кандидаты пары родитель → потомок, по порядку полей: числа, место, время, уверенность, атрибуция */
export function diffStructures(
  parent: DiffSide,
  child: DiffSide,
  uiLanguage: LanguageCode,
): MutationCandidate[] {
  return [
    ...diffNumbers(parent.structure.numbers, child.structure.numbers, uiLanguage),
    ...diffPlaces(parent.structure.places, child.structure.places, uiLanguage),
    ...diffTime(parent, child, uiLanguage),
    ...diffCertainty(parent.structure.certainty, child.structure.certainty, uiLanguage),
    ...diffAttribution(parent, child, uiLanguage),
  ];
}

/**
 * Числа сравниваются внутри одной единицы измерения (без регистра).
 * Сначала снимаются пары «то же число» (разница ≤ 10%), остальные сопоставляются по величине:
 * выросло больше чем на 10% — inflated, уменьшилось — deflated, сменило знак — changed.
 * Лишние числа — появилось / пропало (changed, на месте отсутствующего — «—»).
 */
export function diffNumbers(
  before: ClaimNumber[],
  after: ClaimNumber[],
  uiLanguage: LanguageCode,
): MutationCandidate[] {
  const absent = textsFor(uiLanguage).absent;
  const out: MutationCandidate[] = [];
  const units = [...new Set([...before, ...after].map((n) => unitKey(n.unit)))];
  for (const unit of units) {
    const parents = before.filter((n) => unitKey(n.unit) === unit);
    const children = after.filter((n) => unitKey(n.unit) === unit);

    const restParents: ClaimNumber[] = [];
    for (const p of parents) {
      const same = children.findIndex((c) => compareNumbers(p.value, c.value) === "same");
      if (same >= 0) children.splice(same, 1);
      else restParents.push(p);
    }

    const byValue = (a: ClaimNumber, b: ClaimNumber) => a.value - b.value;
    restParents.sort(byValue);
    children.sort(byValue);
    const paired = Math.min(restParents.length, children.length);
    for (let i = 0; i < paired; i++) {
      const direction = compareNumbers(restParents[i].value, children[i].value);
      if (direction === "same") continue;
      out.push({
        field: "numbers",
        before: numberText(restParents[i]),
        after: numberText(children[i]),
        direction,
      });
    }
    for (const p of restParents.slice(paired)) {
      out.push({ field: "numbers", before: numberText(p), after: absent, direction: "changed" });
    }
    for (const c of children.slice(paired)) {
      out.push({ field: "numbers", before: absent, after: numberText(c), direction: "changed" });
    }
  }
  return out;
}

/** Как изменилось число родителя: по модулю, порог — доля от числа родителя (ровно 10% — ещё то же самое) */
export function compareNumbers(before: number, after: number): Direction | "same" {
  if (before === after) return "same";
  if (before !== 0 && after !== 0 && Math.sign(before) !== Math.sign(after)) return "changed";
  const from = Math.abs(before);
  const to = Math.abs(after);
  if (from === 0) return "inflated";
  // 1e-9 — чтобы 100 → 110 не стало «больше 10%» из-за плавающей точки
  if (Math.abs(to - from) / from <= NUMBER_CHANGE_THRESHOLD + 1e-9) return "same";
  return to > from ? "inflated" : "deflated";
}

/** Места — множества без регистра (и без различия е/ё); разные множества — один кандидат со списками целиком */
export function diffPlaces(before: string[], after: string[], uiLanguage: LanguageCode): MutationCandidate[] {
  const a = uniquePlaces(before);
  const b = uniquePlaces(after);
  const bKeys = new Set(b.map(textKey));
  if (a.length === b.length && a.every((p) => bKeys.has(textKey(p)))) return [];
  const absent = textsFor(uiLanguage).absent;
  return [
    {
      field: "place",
      before: a.join(", ") || absent,
      after: b.join(", ") || absent,
      direction: "changed",
    },
  ];
}

/**
 * Время события (всегда changed). Сутки узла — явная дата (eventTime.date) или маркер от даты его публикации.
 *  1. Сутки известны у обоих и расходятся больше чем на TIME_TOLERANCE_DAYS.
 *  2. Родитель о времени молчит, но вышел раньше, чем, по словам потомка, случилось событие
 *     («старое событие стало вчерашним»).
 *  3. Дат публикации не хватает: у родителя явная дата, у потомка — только «вчера» / «недавно».
 * Пропавшее у потомка время — не кандидат: перепечатка на следующий день законно теряет «сегодня».
 */
export function diffTime(parent: DiffSide, child: DiffSide, uiLanguage: LanguageCode): MutationCandidate[] {
  const p = timeView(parent, uiLanguage);
  const c = timeView(child, uiLanguage);
  const changed = (before: string, after: string): MutationCandidate[] => [
    { field: "time", before, after, direction: "changed" },
  ];

  if (p?.days && c?.days) return gapDays(p.days, c.days) > TIME_TOLERANCE_DAYS ? changed(p.text, c.text) : [];

  const parentDay = dayOf(parent.publishedAt);
  if (!p && c?.days && parentDay !== null) {
    if (c.days.from - parentDay <= TIME_TOLERANCE_DAYS) return [];
    return changed(textsFor(uiLanguage).notLaterThan(formatDay(parentDay, uiLanguage)), c.text);
  }

  if (p?.kind === "date" && c?.kind === "markers") return changed(p.text, c.text);
  return [];
}

/** hedged → asserted — раздули («возможно» стало «точно»), обратно — преуменьшили */
export function diffCertainty(
  before: ClaimStructure["certainty"],
  after: ClaimStructure["certainty"],
  uiLanguage: LanguageCode,
): MutationCandidate[] {
  if (before === after) return [];
  const labels = textsFor(uiLanguage).certainty;
  return [
    {
      field: "certainty",
      before: labels[before],
      after: labels[after],
      direction: after === "asserted" ? "inflated" : "deflated",
    },
  ];
}

/**
 * Атрибуция (changed): на кого ссылается утверждение, без регистра и знаков.
 * Потомок, который ссылается на самого родителя («по данным DW» в перепечатке Deutsche Welle), — не кандидат.
 */
export function diffAttribution(
  parent: DiffSide,
  child: DiffSide,
  uiLanguage: LanguageCode,
): MutationCandidate[] {
  const before = parent.structure.attributedTo?.trim() || null;
  const after = child.structure.attributedTo?.trim() || null;
  if (nameKey(before ?? "") === nameKey(after ?? "")) return [];
  if (after && refersTo(after, parent)) return [];
  const none = textsFor(uiLanguage).noAttribution;
  return [{ field: "attribution", before: before ?? none, after: after ?? none, direction: "changed" }];
}

// ===================== ВСПОМОГАТЕЛЬНОЕ =====================

function unitKey(unit: string): string {
  return textKey(unit).replace(/\.+$/, "");
}

function textKey(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** Только буквы и цифры: «Deutsche Welle» → «deutschewelle», «D.W.» → «dw» */
function nameKey(s: string): string {
  return textKey(s).replace(/[^\p{L}\p{N}]+/gu, "");
}

function numberText(n: ClaimNumber): string {
  return n.raw.trim() || `${n.value}${n.unit.trim() ? ` ${n.unit.trim()}` : ""}`;
}

/** Без пустых и повторов (первое написание), в исходном порядке */
function uniquePlaces(places: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const place of places) {
    const key = textKey(place);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(place.trim());
  }
  return out;
}

/** Имя совпадает с издателем, его аббревиатурой («Deutsche Welle» → DW) или доменом (dw.com → dw) */
function refersTo(name: string, side: DiffSide): boolean {
  const key = nameKey(name);
  if (!key) return false;
  const aliases = new Set<string>();
  if (side.publisher) {
    aliases.add(nameKey(side.publisher));
    const words = side.publisher.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (words.length >= 2) aliases.add(nameKey(words.map((w) => w[0]).join("")));
  }
  if (side.domain) {
    const labels = side.domain
      .toLowerCase()
      .replace(/^www\./, "")
      .split(".");
    for (const label of labels.slice(0, -1)) aliases.add(nameKey(label));
  }
  for (const alias of aliases) {
    if (!alias) continue;
    if (alias === key) return true;
    // «Reuters UK» ↔ «Reuters», «ООН» ↔ «Управление ООН по правам человека»; короткие — только целиком
    if (Math.min(alias.length, key.length) >= 3 && (alias.includes(key) || key.includes(alias))) return true;
  }
  return false;
}

/** Сутки — номер дня UTC от 1970-01-01, включительно с обеих сторон */
interface DayRange {
  from: number;
  to: number;
}

interface TimeView {
  kind: "date" | "markers";
  /** Как время подано — для before / after */
  text: string;
  /** null — сутки не вычислить (маркер, а даты публикации нет) */
  days: DayRange | null;
}

function timeView(side: DiffSide, uiLanguage: LanguageCode): TimeView | null {
  const { eventTime, timeMarkers } = side.structure;
  const explicit = eventTime?.date ? eventDays(eventTime.date) : null;
  if (eventTime?.date && explicit) {
    return { kind: "date", text: eventTime.raw.trim() || eventTime.date, days: explicit };
  }

  const marker = MARKER_ORDER.find((m) => timeMarkers.includes(m));
  if (!marker) return null;
  const label = textsFor(uiLanguage).markers[marker];
  const published = dayOf(side.publishedAt);
  if (published === null) return { kind: "markers", text: label, days: null };
  const [fromBack, toBack] = MARKER_DAYS_BACK[marker];
  const days = { from: published - fromBack, to: published - toBack };
  // «вчера (1 октября 2026)»; у «на этой неделе» точного дня нет
  const text = days.from === days.to ? `${label} (${formatDay(days.from, uiLanguage)})` : label;
  return { kind: "markers", text, days };
}

/** "2022" → весь год, "2022-02" → весь месяц, "2022-02-24" (можно со временем) → этот день; не дата — null */
function eventDays(date: string): DayRange | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T.*)?)?)?$/.exec(date.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : null;
  const day = m[3] ? Number(m[3]) : null;
  const start = Date.UTC(year, month ?? 0, day ?? 1);
  const d = new Date(start);
  if (d.getUTCMonth() !== (month ?? 0) || d.getUTCDate() !== (day ?? 1)) return null;
  const end = day !== null ? start : month !== null ? Date.UTC(year, month + 1, 0) : Date.UTC(year, 11, 31);
  return { from: start / 86_400_000, to: end / 86_400_000 };
}

function dayOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

function gapDays(a: DayRange, b: DayRange): number {
  return Math.max(0, b.from - a.to, a.from - b.to);
}
