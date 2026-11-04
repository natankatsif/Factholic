/**
 * Следы: конкретные зацепки, которые уже найденные копии оставляют на первоисточник.
 *   link     — копия ссылается на страницу, которой нет среди копий;
 *   citation — копия называет источник («по данным мэрии»), которого нет среди копий;
 *   older    — на этом языке ещё не искали раньше самой старой известной копии;
 *   phrase   — цитата из копии, которую можно искать дословно.
 *
 * Важно: след — это задача поиска, а не вопрос об истине. Закрытый след значит «сходили и записали, что нашли».
 * Поиск останавливается, когда открытых следов нет или кончился бюджет; причина остановки попадает в отчёт.
 * То, что вопрос в новости открыт, остановке не мешает: это честный итог, а не пробел поиска.
 * Подробно: obsidian/02_Что_значит_следов_больше_нет.md. Чистые функции, сеть — в copies.ts.
 */
import type { LanguageCode } from "@news/contracts";
import { registrableDomain } from "./select.ts";
import { hits, stemSet } from "./text.ts";
import type { SourceCopy, Trace } from "./types.ts";

/** Кругов добора после первого поиска */
export const MAX_TRACE_ROUNDS = 2;
/** Сколько следов каждого вида берём за круг: самые упоминаемые первыми */
export const MAX_LINKS_PER_ROUND = 6;
export const MAX_CITATIONS_PER_ROUND = 3;
export const MAX_PHRASES_PER_ROUND = 1;
/** Абзац «про утверждение»: столько ключевых слов и больше */
const MIN_PASSAGE_HITS = 2;

/** Не называют конкретный источник: искать нечего */
const VAGUE_SOURCE =
  /^(источник|очевид|эксперт|журналист|пользоват|сми|медиа|surse|sursa|martor|expert|presa|media|source|witness|report|officials?)/iu;

/** «по данным мэрии Кишинёва» → «мэрии Кишинёва» */
const ATTRIBUTION_MARKER =
  /^(по данным|по информации|по словам|со ссылкой на|как сообщает|как сообщил[аио]?|сообщает|сообщил[аио]?|заявил[аио]?|potrivit|conform|citat de|a declarat|a anunțat|according to|reported by|citing|said)\s+/iu;

export function citedName(attribution: string): string {
  return attribution
    .replace(ATTRIBUTION_MARKER, "")
    .replace(/[«»"„”]/g, "")
    .trim();
}

/** Ссылки считаем только из абзацев про утверждение: боковая лента не доказывает, кто у кого взял */
export function claimPassages(markdown: string, claimStems: string[]): string {
  const blocks = markdown.split(/\n\s*\n/);
  const near = new Set<number>();
  blocks.forEach((block, i) => {
    if (hits(stemSet(block), claimStems) < MIN_PASSAGE_HITS) return;
    near.add(i);
    // ссылка часто стоит в соседнем абзаце: «Подробнее — на сайте ведомства»
    if (i + 1 < blocks.length) near.add(i + 1);
  });
  return [...near]
    .sort((a, b) => a - b)
    .map((i) => blocks[i])
    .join("\n\n");
}

/** Запрос без чисел: первоисточник мог называть другую цифру, она и есть мутация */
export function withoutNumbers(query: string): string {
  return query
    .split(/\s+/)
    .filter((word) => !/\d/.test(word))
    .join(" ")
    .trim();
}

function canonical(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[#?].*$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function byCount(counts: Map<string, number>): string[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
}

/** Страницы, на которые ссылаются копии, но которых среди копий нет. Самые частые — первыми */
export function openLinks(copies: SourceCopy[], tried: ReadonlySet<string>): string[] {
  const known = new Set(copies.map((c) => canonical(c.url)));
  const counts = new Map<string, number>();
  const original = new Map<string, string>();
  for (const copy of copies) {
    for (const link of new Set(copy.outboundLinks)) {
      const key = canonical(link);
      if (known.has(key) || tried.has(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!original.has(key)) original.set(key, link);
    }
  }
  return byCount(counts).map((key) => original.get(key)!);
}

/** Есть имя собственное, до 4 слов: «Reuters», «мэрии Кишинёва». «the press», «lui» — обрывки фраз */
const MAX_NAME_WORDS = 4;

export function isSourceName(name: string): boolean {
  return /(^|\s)\p{Lu}/u.test(name) && name.length >= 3 && name.split(/\s+/).length <= MAX_NAME_WORDS;
}

function namesCopy(name: string, copy: SourceCopy): boolean {
  const lower = name.toLowerCase();
  const site = registrableDomain(copy.domain).split(".")[0];
  return lower.includes(copy.publisher.toLowerCase()) || (site.length > 3 && lower.includes(site));
}

/** Названные источники, которых нет среди копий. Самые частые — первыми */
export function openCitations(copies: SourceCopy[], tried: ReadonlySet<string>): string[] {
  const counts = new Map<string, number>();
  const shown = new Map<string, string>();
  for (const copy of copies) {
    for (const attribution of copy.attributions) {
      const name = citedName(attribution);
      const key = name.toLowerCase();
      if (!isSourceName(name) || VAGUE_SOURCE.test(name) || tried.has(key)) continue;
      if (copies.some((c) => namesCopy(name, c))) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!shown.has(key)) shown.set(key, name);
    }
  }
  return byCount(counts).map((key) => shown.get(key)!);
}

/** Сколько слов берём из цитаты для точного запроса */
const EXACT_QUERY_WORDS = 8;
const MIN_EXACT_WORDS = 4;

/** Дословный фрагмент в кавычках: находит страницы, которые пересказ поисковика не поднимает */
export function exactQuery(quote: string): string | null {
  const words = quote
    .replace(/[«»"„“”]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return words.length < MIN_EXACT_WORDS ? null : `"${words.slice(0, EXACT_QUERY_WORDS).join(" ")}"`;
}

/** Цитаты из найденных страниц: следующая находка часто повторяет их дословно */
const QUOTED = /[«"„“]([^«»"„“”]{25,120})[»"”]/gu;

export function quotedPhrases(copies: SourceCopy[], tried: ReadonlySet<string>): string[] {
  const counts = new Map<string, number>();
  const shown = new Map<string, string>();
  for (const copy of copies) {
    for (const [, phrase] of copy.excerpt.matchAll(QUOTED)) {
      const text = phrase.trim();
      const key = text.toLowerCase();
      if (text.split(/\s+/).length < MIN_EXACT_WORDS || tried.has(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!shown.has(key)) shown.set(key, text);
    }
  }
  return byCount(counts).map((key) => shown.get(key)!);
}

/** Самая ранняя дата среди копий: от неё считается поиск более ранних */
export function oldestDate(copies: SourceCopy[]): string | undefined {
  return copies
    .map((c) => c.publishedAt)
    .filter((d): d is string => !!d)
    .sort()[0];
}

/** Языки, на которых ещё не искали раньше этой даты */
export function openLanguages(
  languages: LanguageCode[],
  oldest: string | undefined,
  searchedBefore: ReadonlyMap<LanguageCode, string>,
): LanguageCode[] {
  if (!oldest) return [];
  return languages.filter((language) => {
    const last = searchedBefore.get(language);
    return !last || oldest < last;
  });
}

/** Следы, на которые не хватило бюджета: отчёт должен сказать о них прямо */
export function outOfBudget(kind: Trace["kind"], targets: string[]): Trace[] {
  return targets.map((target) => ({ kind, target, status: "out_of_budget" }));
}
