/**
 * Предфильтр мутаций кодом: сравнивает структуру утверждения у родителя и потомка по полям и выдаёт
 * кандидатов — что и в какую сторону изменилось. Чистые функции без внешних API.
 * Кандидаты потом подтверждает или отклоняет LLM (real.ts): код не знает, что «Кишинёв» и «столица Молдовы» —
 * одно место, а «вдвое больше» и «200» — может быть, одно число.
 */
import type { ISODateString, LanguageCode } from "@news/contracts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import { formatDay, textsFor } from "./texts.ts";
import type { ClaimMutation } from "./types.ts";

// ===================== ПРАВИЛА =====================

/** Число изменилось больше чем на эту долю от числа у родителя — раздули / преуменьшили; иначе то же самое */
export const NUMBER_CHANGE_THRESHOLD = 0.1;
/** Во сколько раз число должно вырасти (упасть), чтобы это было «раздуто» («преуменьшено») */
export const INFLATION_RATIO = 1.5;

/** Сутки события у родителя и потомка расходятся больше чем на столько — время изменилось */
export const TIME_TOLERANCE_DAYS = 1;

/** hedged < reported < asserted: рост уверенности — раздули, падение — преуменьшили */
const CERTAINTY_RANK: Record<ClaimStructure["certainty"], number> = { hedged: 0, reported: 1, asserted: 2 };

// ===================== ТИПЫ =====================

type Direction = ClaimMutation["direction"];

/** Число структуры: { value: "200", about: "пострадавших" } */
export type StructureNumber = ClaimStructure["numbers"][number];

/** Кандидат в мутацию — ClaimMutation без узлов и note */
export type MutationCandidate = Pick<ClaimMutation, "field" | "before" | "after" | "direction">;

/** Узел дерева глазами сравнения: структура и то, что нужно, чтобы её понять */
export interface DiffSide {
  structure: ClaimStructure;
  /** От неё считаются «сегодня» / «вчера» узла, если этап 03/05 не вычислил дату */
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
 * Числа сопоставляются по тому, что они считают (`about`: без регистра, по основам слов —
 * «пострадавших» = «пострадавшие» = «человек пострадали»), значение разбирается из строки (parseNumber).
 * Сначала снимаются пары «то же число» (разница ≤ 10%), остальные сопоставляются по величине:
 * выросло больше чем на 10% — inflated, уменьшилось — deflated, сменило знак или не разбирается и
 * написано иначе — changed. Лишние числа: у потомка — added, у родителя — removed (на месте отсутствующего «—»).
 */
export function diffNumbers(
  before: StructureNumber[],
  after: StructureNumber[],
  uiLanguage: LanguageCode,
): MutationCandidate[] {
  const absent = textsFor(uiLanguage).absent;
  const parents = before.filter((n) => n.value.trim()).map(numberItem);
  const children = after.filter((n) => n.value.trim()).map(numberItem);

  const rest: NumberItem[] = [];
  for (const p of parents) {
    const same = children.findIndex((c) => sameAbout(p, c) && compareValues(p, c) === "same");
    if (same >= 0) children.splice(same, 1);
    else rest.push(p);
  }

  // меньшее с меньшим, большее с большим — внутри одного «о чём»
  rest.sort(byMagnitude);
  children.sort(byMagnitude);
  const out: MutationCandidate[] = [];
  for (const p of rest) {
    const i = children.findIndex((c) => sameAbout(p, c));
    if (i < 0) {
      out.push({ field: "numbers", before: p.text, after: absent, direction: "removed" });
      continue;
    }
    const [c] = children.splice(i, 1);
    const direction = compareValues(p, c);
    if (direction !== "same") out.push({ field: "numbers", before: p.text, after: c.text, direction });
  }
  for (const c of children) out.push({ field: "numbers", before: absent, after: c.text, direction: "added" });
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
  // «раздуто» / «преуменьшено» — только в разы (2 → 200, 10 → 50 см); 10–50% — расхождение источников
  // (статистика разных лет и методик: 2,37 млн → 2,68 млн), а не преувеличение
  if (to >= from * INFLATION_RATIO) return "inflated";
  if (to * INFLATION_RATIO <= from) return "deflated";
  return "changed";
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
 * Время события (всегда shifted). Сутки узла — time.date (у относительного времени её считает этап 03/05
 * от даты публикации), а если даты нет — по словам time.text («вчера», «недавно») от даты публикации узла.
 *  1. Сутки известны у обоих и расходятся больше чем на TIME_TOLERANCE_DAYS.
 *  2. Родитель о времени молчит, но вышел раньше, чем, по словам потомка, случилось событие
 *     («старое событие стало вчерашним»).
 *  3. У родителя явная дата, у потомка — относительное время («вчера», «недавно»), которое не посчитать:
 *     давнее событие подано как недавнее.
 * Пропавшее у потомка время — не кандидат: перепечатка на следующий день законно теряет «сегодня».
 */
export function diffTime(parent: DiffSide, child: DiffSide, uiLanguage: LanguageCode): MutationCandidate[] {
  const p = timeView(parent, uiLanguage);
  const c = timeView(child, uiLanguage);
  const shifted = (before: string, after: string): MutationCandidate[] => [
    { field: "time", before, after, direction: "shifted" },
  ];

  if (p?.days && c?.days) return gapDays(p.days, c.days) > TIME_TOLERANCE_DAYS ? shifted(p.text, c.text) : [];

  const parentDay = dayOf(parent.publishedAt);
  if (!p && c?.days && parentDay !== null) {
    if (c.days.from - parentDay <= TIME_TOLERANCE_DAYS) return [];
    return shifted(textsFor(uiLanguage).notLaterThan(formatDay(parentDay, uiLanguage)), c.text);
  }

  if (p?.kind === "date" && c?.kind === "relative" && !c.days) return shifted(p.text, c.text);
  return [];
}

/**
 * Уверенность: hedged («возможно») < reported («по данным мэрии») < asserted (как факт).
 * Выросла — раздули («возможно» стало «точно»), упала — преуменьшили.
 */
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
      direction: CERTAINTY_RANK[after] > CERTAINTY_RANK[before] ? "inflated" : "deflated",
    },
  ];
}

/**
 * Атрибуция: на кого ссылается утверждение, без регистра и знаков.
 * added — ссылки не было, появилась; removed — была, исчезла; changed — источник подменён.
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
  // added — перепечатка сослалась на источник (честнее), removed — ссылку убрала, changed — подменила источник
  const direction = !before ? "added" : !after ? "removed" : "changed";
  return [{ field: "attribution", before: before ?? none, after: after ?? none, direction }];
}

// ===================== ЧИСЛА =====================

type Dimension = "length" | "mass";

export interface ParsedNumber {
  /** С множителем, без перевода единиц: «3,5 млн» → 3 500 000, «50 см» → 50, «полметра» → 0.5 */
  value: number;
  /** Узнанная единица измерения; null — нет или не узнана */
  dim: Dimension | null;
  /** В базовой единице (метры, килограммы); без единицы — как value */
  base: number;
}

/** Множители после числа: «5 тыс.», «3,5 млн», «2 billion», «20 de mii» */
const MULTIPLIERS: Array<[RegExp, number]> = [
  [/^(?:тыс\p{L}*|thousands?|k|mii|mie)$/u, 1e3],
  [/^(?:млн|миллион\p{L}*|millions?|mln|milio(?:n|ane)\p{L}*)$/u, 1e6],
  [/^(?:млрд|миллиард\p{L}*|billions?|bn|bln|miliard\p{L}*)$/u, 1e9],
  [/^(?:трлн|триллион\p{L}*|trillions?|trilio(?:n|ane)\p{L}*)$/u, 1e12],
];

/** Единицы, которые можно перевести друг в друга: «полметра» = «50 см» */
const UNITS: Array<[RegExp, Dimension, number]> = [
  [/^(?:мм|миллиметр\p{L}*|mm|millimet\p{L}*|milimetr\p{L}*)$/u, "length", 0.001],
  [/^(?:см|сантиметр\p{L}*|cm|centimet\p{L}*)$/u, "length", 0.01],
  [/^(?:км|километр\p{L}*|km|kilomet\p{L}*)$/u, "length", 1000],
  [/^(?:м|метр\p{L}*|m|met(?:er|re|ri|ru)\p{L}*)$/u, "length", 1],
  [/^(?:грамм\p{L}*|gram\p{L}*)$/u, "mass", 0.001],
  [/^(?:кг|килограмм\p{L}*|kg|kilogram\p{L}*)$/u, "mass", 1],
  [/^(?:т|тонн\p{L}*|tons?|tonnes?|tone|tonă)$/u, "mass", 1000],
];

/** Числа словами — для «две тысячи», «полтора миллиона», «half a million», «două sute» */
const NUMBER_WORDS: Record<string, number> = {
  пол: 0.5,
  полтора: 1.5,
  полторы: 1.5,
  один: 1,
  одна: 1,
  одно: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  сто: 100,
  двести: 200,
  триста: 300,
  пятьсот: 500,
  half: 0.5,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twenty: 20,
  thirty: 30,
  fifty: 50,
  jumătate: 0.5,
  jumatate: 0.5,
  unu: 1,
  doi: 2,
  două: 2,
  doua: 2,
  trei: 3,
  patru: 4,
  cinci: 5,
  șase: 6,
  sase: 6,
  șapte: 7,
  sapte: 7,
  opt: 8,
  nouă: 9,
  noua: 9,
  zece: 10,
  douăzeci: 20,
  douazeci: 20,
};

/** «hundred» / «sute» умножают предыдущее: «two hundred» = 200, «o sută» = 100; «sute» без числа — «сотни» */
const HUNDRED_WORDS = new Set(["hundred", "sută", "suta", "sute"]);
const PLURAL_HUNDRED = "sute";

/** Множитель без числа перед ним — только в единственном числе: «тысяча» = 1000, а «тысячи», «millions» — неточно */
const SINGULAR_MULTIPLIER =
  /^(?:тысяча|миллион|миллиард|триллион|thousand|million|billion|trillion|mie|milion|miliard|trilion)$/u;

/** Служебные слова между числом, множителем и единицей: «half a million», «20 de mii», «o mie» */
const FILLER_WORDS = new Set(["a", "an", "of", "de", "o", "un", "una"]);

/**
 * Что может стоять перед числом словами, не меняя его: «около двухсот», «more than a million».
 * Любое другое слово («десятки тысяч», «hundreds of thousands») — число неточное, не разбираем.
 */
const QUALIFIER_WORDS = new Set(
  [
    "около более менее почти примерно приблизительно свыше до больше меньше порядка целых",
    "about around over nearly almost approximately roughly some up to more less than under",
    "peste aproximativ circa aproape până pana la mai mult puțin putin",
  ]
    .join(" ")
    .split(" "),
);

/** Первое число в записи: «1 200», «1,200.5», «3,5»; группы разрядов — только по три цифры */
const NUMBER_RE =
  /(?<![\p{L}\p{N}])(?:[1-9]\d{0,2}([ .,'’])\d{3}(?:\1\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?!\p{N})/u;

/**
 * Значение числа из строки этапа 03 (`value`): «200», «3,5 млн», «1 200», «до 10 см», «полмиллиона»,
 * «две тысячи», «half a million», «20 de mii». Не разбирается («вдвое», «десятки») — null.
 */
export function parseNumber(text: string): ParsedNumber | null {
  const s = textKey(text.replace(/[\u00a0\u2009\u202f]/g, " ").replace(/[−–—]/g, "-"));
  const m = NUMBER_RE.exec(s);
  if (m) {
    const sep = m[1];
    const digits = sep ? m[0].split(sep).join("") : m[0];
    const value = Number(digits.replace(",", "."));
    if (!Number.isFinite(value)) return null;
    const negative = /(?:^|[^\p{L}\p{N}])(?:-|минус|minus)\s*$/u.test(s.slice(0, m.index));
    return withSuffix(negative ? -value : value, tokens(s.slice(m.index + m[0].length)));
  }

  const words = tokens(s);
  const start = words.findIndex((w) => w in NUMBER_WORDS || HUNDRED_WORDS.has(w) || multiplierOf(w) !== null);
  if (start < 0) return null;
  if (words.slice(0, start).some((w) => !QUALIFIER_WORDS.has(w) && !FILLER_WORDS.has(w))) return null;
  let value: number | null = null;
  let i = start;
  for (; i < words.length; i++) {
    const w = words[i];
    if (HUNDRED_WORDS.has(w)) {
      if (value === null && w === PLURAL_HUNDRED) return null;
      value = (value ?? 1) * 100;
    } else if (w in NUMBER_WORDS) value = (value ?? 0) + NUMBER_WORDS[w];
    else if (!FILLER_WORDS.has(w)) break;
  }
  if (value === null && !SINGULAR_MULTIPLIER.test(words[i] ?? "")) return null;
  return withSuffix(value ?? 1, words.slice(i));
}

/** Множитель и единица после числа */
function withSuffix(n: number, rest: string[]): ParsedNumber {
  let value = n;
  let i = 0;
  const skipFillers = () => {
    while (i < rest.length && FILLER_WORDS.has(rest[i])) i++;
  };
  skipFillers();
  const multiplier = i < rest.length ? multiplierOf(rest[i]) : null;
  if (multiplier !== null) {
    value *= multiplier;
    i++;
    skipFillers();
    // составное число: «2 млн 401 тысяча» = 2 401 000 (младший разряд с меньшим множителем)
    const tail = /^\d+$/.test(rest[i] ?? "") ? multiplierOf(rest[i + 1] ?? "") : null;
    if (tail !== null && tail < multiplier) {
      value += Number(rest[i]) * tail;
      i += 2;
      skipFillers();
    }
  }
  const unit = i < rest.length ? UNITS.find(([re]) => re.test(rest[i])) : undefined;
  return unit ? { value, dim: unit[1], base: value * unit[2] } : { value, dim: null, base: value };
}

function multiplierOf(word: string): number | null {
  return MULTIPLIERS.find(([re]) => re.test(word))?.[1] ?? null;
}

/** Слова строки; «полмиллиона» → «пол» + «миллиона», «полметра» → «пол» + «метра» */
function tokens(s: string): string[] {
  return s
    .split(/[^\p{L}\p{N}%]+/u)
    .filter(Boolean)
    .flatMap((w) => {
      const rest = w.startsWith("пол") && w.length > 3 ? w.slice(3) : "";
      return rest && (multiplierOf(rest) !== null || UNITS.some(([re]) => re.test(rest)))
        ? ["пол", rest]
        : [w];
    });
}

interface NumberItem {
  /** Как в структуре — для сравнения строк, если число не разбирается */
  value: string;
  /** Для before / after: «200 пострадавших» */
  text: string;
  parsed: ParsedNumber | null;
  /** Значимые слова about, без служебных */
  about: string[];
}

function numberItem(n: StructureNumber): NumberItem {
  const value = n.value.trim();
  const about = n.about.trim();
  return {
    value,
    text: about ? `${value} ${about}` : value,
    // множитель часто уходит в about: { value: "2 365,6", about: "тысяч жителей" } — это 2 365 600, а не 2 365,6
    parsed: parseNumber(about ? `${value} ${about}` : value),
    about: aboutWords(about),
  };
}

/** Оба разобраны — по величине (в одной единице или без перевода, если единица есть только у одного), иначе — строки */
function compareValues(p: NumberItem, c: NumberItem): Direction | "same" {
  if (p.parsed && c.parsed) {
    if (p.parsed.dim === c.parsed.dim) return compareNumbers(p.parsed.base, c.parsed.base);
    if (!p.parsed.dim || !c.parsed.dim) return compareNumbers(p.parsed.value, c.parsed.value);
  }
  return valueKey(p.value) === valueKey(c.value) ? "same" : "changed";
}

/** Неразобранные — в конце */
function byMagnitude(a: NumberItem, b: NumberItem): number {
  const x = a.parsed ? Math.abs(a.parsed.base) : Infinity;
  const y = b.parsed ? Math.abs(b.parsed.base) : Infinity;
  return x === y ? 0 : x < y ? -1 : 1;
}

function valueKey(value: string): string {
  return textKey(value).replace(/\s+/g, "");
}

const STOP_WORDS = new Set(
  [
    "в во на и с со по из от до для за к ко о об у не а но или что как",
    "the a an of in on at for and to by from with or as",
    "de la în in din și si cu pe a al ale ai o un pentru care sau",
  ]
    .join(" ")
    .split(" "),
);

/** Значимые слова about; если значимых нет — все */
function aboutWords(about: string): string[] {
  const words = textKey(about)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  return meaningful.length ? meaningful : words;
}

/**
 * Считают ли числа одно и то же: каждое слово более короткого about есть в более длинном
 * (по основе слова: «пострадавших» = «пострадали»). Пустой about совпадает только с пустым.
 */
function sameAbout(a: NumberItem, b: NumberItem): boolean {
  if (!a.about.length || !b.about.length) return a.about.length === b.about.length;
  const [short, long] = a.about.length <= b.about.length ? [a.about, b.about] : [b.about, a.about];
  return short.every((w) => long.some((x) => sameStem(w, x)));
}

/** Общее начало не короче max(3, длина короткого − 3); слова с цифрами и короткие — только целиком */
function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 3 || /\p{N}/u.test(a) || /\p{N}/u.test(b)) return false;
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  return i >= Math.max(3, min - 3);
}

// ===================== ВРЕМЯ =====================

type RelativeWord = "just_now" | "now" | "today" | "yesterday" | "this_week" | "recently";

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

/** Какие сутки заявляет слово относительно даты публикации: [от, до] дней назад */
const RELATIVE_DAYS_BACK: Record<RelativeWord, [number, number]> = {
  just_now: [0, 0],
  now: [0, 0],
  today: [0, 0],
  yesterday: [1, 1],
  this_week: [7, 0],
  recently: [7, 0],
};

/** Самое «свежее» слово относительного времени в тексте; не узнано — null */
function relativeWord(text: string): RelativeWord | null {
  const s = textKey(text);
  return RELATIVE_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;
}

/** Сутки — номер дня UTC от 1970-01-01, включительно с обеих сторон */
interface DayRange {
  from: number;
  to: number;
}

interface TimeView {
  /** date — явная дата; relative — «вчера», «недавно» (с датой, посчитанной от публикации, или без неё) */
  kind: "date" | "relative";
  /** Как время подано — для before / after */
  text: string;
  /** null — сутки не вычислить (относительное время без даты, а даты публикации нет) */
  days: DayRange | null;
}

function timeView(side: DiffSide, uiLanguage: LanguageCode): TimeView | null {
  const time = side.structure.time;
  if (!time) return null;
  const text = time.text.trim();
  const date = time.date?.trim() || null;
  const explicit = date ? eventDays(date) : null;
  if (explicit && !time.relative) return { kind: "date", text: text || (date ?? ""), days: explicit };
  if (!time.relative) return null;

  let days = explicit;
  if (!days) {
    const word = relativeWord(text);
    const published = dayOf(side.publishedAt);
    if (word && published !== null) {
      const [fromBack, toBack] = RELATIVE_DAYS_BACK[word];
      days = { from: published - fromBack, to: published - toBack };
    }
  }
  const label = text || date || textsFor(uiLanguage).absent;
  // «вчера (1 октября 2026)»; у «на этой неделе» точного дня нет
  if (days && days.from === days.to)
    return { kind: "relative", text: `${label} (${formatDay(days.from, uiLanguage)})`, days };
  return { kind: "relative", text: label, days };
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

// ===================== ВСПОМОГАТЕЛЬНОЕ =====================

/** Без регистра, ё = е, румынские ş/ţ с седилью = ș/ț с запятой */
function textKey(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/\s+/g, " ").trim();
}

/** Только буквы и цифры: «Deutsche Welle» → «deutschewelle», «D.W.» → «dw» */
function nameKey(s: string): string {
  return textKey(s).replace(/[^\p{L}\p{N}]+/gu, "");
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
