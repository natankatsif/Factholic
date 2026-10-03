/**
 * Работа с текстом страниц: ключевые слова тезиса, вырезка релевантного excerpt и snippet, язык.
 * Сравнение слов — по «основе» (первые 5 букв), чтобы «Украине» и «Украина» совпадали без морфологии.
 */
import type { LanguageCode } from "@news/contracts";

const STOPWORDS = new Set(
  (
    "это как что чем для или при над под без про его она они оно был была были быть есть уже ещё еще " +
    "так там тут где когда тоже также который которая которые этот эта эти того этом всё все свой " +
    "the and for are was were with that this from have has had not but its their they them than " +
    "which what when where who will would been into about over after also more most such only " +
    // слова из запросов-проверок: есть в любой статье фактчекера, о теме ничего не говорят
    "fact facts check checks checked checking checker debunk debunked hoax fake myth myths true false " +
    "claim claims verdict rating факт факты фактчек проверка проверки проверено опровержение миф мифы " +
    "фейк правда ложь утверждение"
  ).split(" "),
);

const STEM = 5;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Основы значимых слов: длина ≥ 3, не стоп-слово, не число.
 * Числа (годы, «8») не берём: совпадение одного года не делает страницу релевантной.
 */
export function keywordStems(...texts: string[]): string[] {
  const stems = new Set<string>();
  for (const t of texts.flatMap(tokenize)) {
    if (t.length >= 3 && !STOPWORDS.has(t) && !/^\p{N}+$/u.test(t)) stems.add(t.slice(0, STEM));
  }
  return [...stems];
}

/** Множество основ всех слов текста — считается один раз на страницу */
export function stemSet(text: string): Set<string> {
  return new Set(tokenize(text).map((t) => t.slice(0, STEM)));
}

/** Сколько ключевых слов есть в тексте (по готовому stemSet) */
export function hits(present: Set<string>, stems: string[]): number {
  return stems.filter((s) => present.has(s)).length;
}

/** Доля ключевых слов, встречающихся в тексте: 0..1 */
export function coverage(text: string, stems: string[]): number {
  return stems.length ? hits(stemSet(text), stems) / stems.length : 0;
}

/** Куски текста ~ по абзацам, длинные абзацы режем по предложениям. */
function passages(text: string, target = 400): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n\s*\n|\n/)) {
    const p = paragraph.replace(/\s+/g, " ").trim();
    if (p.length < 40) continue; // меню, подписи, кнопки
    if (p.length <= target * 1.5) {
      out.push(p);
      continue;
    }
    let buf = "";
    for (const sentence of p.split(/(?<=[.!?…])\s+/)) {
      if (buf && buf.length + sentence.length > target) {
        out.push(buf);
        buf = "";
      }
      buf = buf ? `${buf} ${sentence}` : sentence;
    }
    if (buf) out.push(buf);
  }
  return out;
}

/**
 * Самые релевантные куски страницы до maxChars, в исходном порядке.
 * Это то, что читает LLM на этапе 05, поэтому лучше чуть больше контекста, чем меньше.
 */
export function pickExcerpt(text: string, stems: string[], maxChars = 2000): string {
  const scored = passages(text.slice(0, 200_000)).map((p, i) => ({ p, i, score: coverage(p, stems) }));
  const picked: typeof scored = [];
  let length = 0;
  for (const item of scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)) {
    if (length + item.p.length > maxChars && picked.length) continue;
    picked.push(item);
    length += item.p.length;
    if (length >= maxChars) break;
  }
  const excerpt = picked
    .sort((a, b) => a.i - b.i)
    .map((s) => s.p)
    .join(" … ");
  return truncate(excerpt || text.replace(/\s+/g, " ").trim(), maxChars);
}

/** 1–2 предложения для карточки во фронте: самое релевантное предложение excerpt'а. */
export function pickSnippet(excerpt: string, stems: string[], maxChars = 280): string {
  const sentences = excerpt
    .split(/(?<=[.!?…])\s+| … /)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
  if (!sentences.length) return truncate(excerpt, maxChars);
  const best = sentences.reduce((a, b) => (coverage(b, stems) > coverage(a, stems) ? b : a));
  return truncate(best, maxChars);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), maxChars / 2)) + "…";
}

const CYRILLIC_LANGS = new Set(["ru", "uk", "be", "bg", "sr", "mk", "kk", "ky", "tg", "mn"]);

/** Частые служебные слова латинских языков — грубо, но лучше, чем считать любую латиницу английским */
const LATIN_MARKERS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "is", "that", "with"],
  de: ["der", "die", "und", "das", "ist", "nicht", "mit"],
  fr: ["le", "les", "et", "est", "des", "une", "pas"],
  es: ["el", "los", "las", "que", "por", "una", "del"],
  it: ["il", "che", "della", "per", "non", "sono", "una"],
  pl: ["nie", "jest", "się", "oraz", "jak", "przez", "dla"],
};

/**
 * Грубое определение языка по алфавиту и служебным словам: поиск не сообщает язык страницы,
 * а запрос на английском вполне может вернуть страницу на русском.
 */
export function detectLanguage(text: string, fallback: LanguageCode): LanguageCode {
  const sample = text.slice(0, 3000);
  const letters = sample.match(/\p{L}/gu)?.length ?? 0;
  if (!letters) return fallback;
  const share = (re: RegExp) => (sample.match(re)?.length ?? 0) / letters;
  const count = (re: RegExp) => sample.match(re)?.length ?? 0;

  if (share(/\p{Script=Cyrillic}/gu) > 0.5) {
    if (count(/[ўЎ]/g)) return "be";
    // і/ї/є/ґ есть в украинском (і — ещё в белорусском), ы/э/ъ — в русском; одно слово «Україна»
    // в русском тексте не делает его украинским
    const ukrainian = count(/[іїєґІЇЄҐ]/g);
    const russian = count(/[ыэъЫЭЪ]/g);
    if (ukrainian > russian) return fallback === "be" ? "be" : "uk";
    return CYRILLIC_LANGS.has(fallback) ? fallback : "ru";
  }
  if (share(/\p{Script=Latin}/gu) > 0.5) {
    const words = tokenize(sample);
    let best: LanguageCode | undefined;
    let bestScore = 0;
    for (const [lang, markers] of Object.entries(LATIN_MARKERS)) {
      const set = new Set(markers);
      const score = words.filter((w) => set.has(w)).length;
      if (score > bestScore) [best, bestScore] = [lang, score];
    }
    if (best && bestScore >= 3) return best;
    return CYRILLIC_LANGS.has(fallback) ? "en" : fallback;
  }
  return fallback;
}
