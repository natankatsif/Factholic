/**
 * Построение дерева первоисточника — чистые функции без LLM и сети (тестируются отдельно, tree.test.ts).
 * На входе — копии из этапа 04 (внешние ссылки, «по данным …» из текста) со структурой и атрибуциями от LLM
 * (шаг 1) и похожесть текстов (эмбеддинги или шинглы).
 * Внутри копии адресуются индексами во входном массиве; id появляются только в выходе.
 */
import type { ClaimId, ISODateString, SourceId } from "@news/contracts";
import type { Claim, ClaimStructure } from "../03-claim-extraction/types.ts";
import type { SourceCopy } from "../04-source-search/types.ts";
import {
  VIDEO_NODE_ID,
  type CopyRelation,
  type HiddenSource,
  type ProvenanceTree,
  type ProvenanceVia,
  type TreeNode,
} from "./types.ts";

export type { CopyRelation };

// ===================== КОНСТАНТЫ =====================

/** Косинус эмбеддингов (title + excerpt), начиная с которого две копии — перепечатка одного текста */
export const DUP_THRESHOLD = 0.9;
/** Фолбэк, когда эмбеддинги недоступны: Jaccard по шинглам из SHINGLE_SIZE слов */
export const SHINGLE_THRESHOLD = 0.5;
export const SHINGLE_SIZE = 5;
/** Сколько копий читает LLM на шаге 1; остальные остаются в дереве, но без структуры и атрибуций */
export const MAX_COPIES = 20;
/** Сколько символов excerpt читаем (LLM, эмбеддинги, шинглы) — по контракту 04 он и так до ~2000 */
export const MAX_EXCERPT_CHARS = 2000;
/** Издатель узла "video" */
export const VIDEO_PUBLISHER = "Это видео";

// ===================== ТИПЫ =====================

/** Копия после шага 1 (LLM) */
export interface CopyFacts {
  source: SourceCopy;
  /** null — самого утверждения в копии нет (или структуру не извлекали) */
  structure: ClaimStructure | null;
  /**
   * Кого копия называет источником утверждения по мнению LLM («Reuters»); непосредственный — первым.
   * Фразы-атрибуции этапа 04 (`source.attributions`) добавляются к ним в `copyCites`.
   */
  cites: string[];
  /** Как копия относится к утверждению: разбор фейка и сам фейк — не один голос. Нет — считаем repeats */
  relation?: CopyRelation;
}

export interface Similarity {
  /** embeddings — косинус, порог DUP_THRESHOLD; shingles — Jaccard по шинглам, порог SHINGLE_THRESHOLD */
  method: "embeddings" | "shingles";
  /** Похожесть копий попарно: pairs[i][j] */
  pairs: number[][];
  /** Похожесть копии на утверждение из видео: выбор родителя видео и копий для LLM */
  toClaim: number[];
}

export interface VideoFacts {
  url: string;
  title: string;
  publishedAt?: ISODateString;
  structure: ClaimStructure | null;
}

/** Ребро-кандидат: индексы копий */
export interface Edge {
  parent: number;
  child: number;
  via: ProvenanceVia;
  confidence: "confirmed" | "probable";
}

// ===================== ТЕКСТЫ И ПОХОЖЕСТЬ =====================

/** Текст копии для эмбеддингов и шинглов: заголовок + фрагмент (непустой — API эмбеддингов пустых не берёт) */
export function copyText(s: Pick<SourceCopy, "title" | "excerpt" | "url">): string {
  return `${s.title}\n${s.excerpt.slice(0, MAX_EXCERPT_CHARS)}`.trim() || s.url;
}

/** Текст утверждения из видео: переформулировка + дословная цитата */
export function claimText(c: Pick<Claim, "normalized" | "quote" | "id">): string {
  return `${c.normalized}\n${c.quote}`.trim() || c.id;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function embeddingSimilarity(claimVector: number[], copyVectors: number[][]): Similarity {
  return {
    method: "embeddings",
    pairs: copyVectors.map((a) => copyVectors.map((b) => cosine(a, b))),
    toClaim: copyVectors.map((v) => cosine(claimVector, v)),
  };
}

export function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Шинглы — все подряд идущие окна по size слов; текст короче окна — один шингл из всех слов */
export function shingles(text: string, size = SHINGLE_SIZE): Set<string> {
  const w = words(text);
  if (w.length <= size) return new Set(w.length ? [w.join(" ")] : []);
  const out = new Set<string>();
  for (let i = 0; i + size <= w.length; i++) out.add(w.slice(i, i + size).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return common / (a.size + b.size - common);
}

/**
 * Фолбэк без эмбеддингов: копии попарно — Jaccard по шинглам; копия ↔ утверждение — доля слов утверждения,
 * которые есть в копии (утверждение — одна фраза, шинглы с длинным текстом почти никогда не совпадут).
 */
export function shingleSimilarity(claim: string, texts: string[]): Similarity {
  const sets = texts.map((t) => shingles(t));
  const claimWords = new Set(words(claim));
  return {
    method: "shingles",
    pairs: sets.map((a) => sets.map((b) => jaccard(a, b))),
    toClaim: texts.map((t) => {
      if (!claimWords.size) return 0;
      const own = new Set(words(t));
      let found = 0;
      for (const w of claimWords) if (own.has(w)) found++;
      return found / claimWords.size;
    }),
  };
}

/** Какие копии отправить LLM на шаге 1: сначала датированные (дата — главный материал дерева), внутри — самые похожие на утверждение */
export function pickForExtraction(
  copies: Array<Pick<SourceCopy, "publishedAt"> & Partial<Pick<SourceCopy, "earliestSearch" | "traced">>>,
  toClaim: number[],
  max = MAX_COPIES,
  /** Ранние и найденные по следу копии читаем первыми: корнем может стать только прочитанная копия */
  earlyFirst = false,
): number[] {
  const dated = (i: number) => (validDate(copies[i].publishedAt) ? 1 : 0);
  const early = (i: number) => (earlyFirst && (copies[i].earliestSearch || copies[i].traced) ? 1 : 0);
  return copies
    .map((_, i) => i)
    .sort(
      (a, b) => early(b) - early(a) || dated(b) - dated(a) || (toClaim[b] ?? 0) - (toClaim[a] ?? 0) || a - b,
    )
    .slice(0, max)
    .sort((a, b) => a - b);
}

// ===================== URL И ДАТЫ =====================

const TRACKING_PARAMS = new Set(["fbclid", "gclid"]);

/**
 * Канонический вид URL для сравнения ссылок: без схемы, без www., без #, без utm_* / fbclid / gclid,
 * без завершающего /; хост в нижнем регистре, путь раскодирован, параметры отсортированы.
 */
export function canonicalUrl(raw: string): string {
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return text.toLowerCase();
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  let path = url.pathname;
  try {
    path = decodeURI(path);
  } catch {
    // битая percent-кодировка — сравниваем как есть
  }
  path = path.replace(/\/+$/, "");
  const params = [...url.searchParams]
    .filter(([k]) => !/^utm_/i.test(k) && !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${host}${port}${path}${query}`;
}

/** Домен без www. для узла видео; не URL — "" */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const DATE_ONLY = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** Дата, если её можно разобрать; иначе undefined (узел считается недатированным) */
export function validDate(s: string | undefined): string | undefined {
  return s && !Number.isNaN(Date.parse(s)) ? s : undefined;
}

/** "YYYY" / "YYYY-MM" / "YYYY-MM-DD" как есть; полная метка времени — её дата в UTC */
function dateKey(s: string): string {
  return DATE_ONLY.test(s) ? s : new Date(Date.parse(s)).toISOString().slice(0, 10);
}

/**
 * Сравнение дат с точностью менее точной из двух: "2026-10-02" и "2026-10-02T18:00:00Z" равны
 * (дата из URL без времени не делает копию «раньше» статьи того же дня). < 0 — a раньше, 0 — равны, > 0 — позже.
 */
export function compareDates(a: string, b: string): number {
  if (!DATE_ONLY.test(a) && !DATE_ONLY.test(b)) return Math.sign(Date.parse(a) - Date.parse(b));
  const ka = dateKey(a);
  const kb = dateKey(b);
  const len = Math.min(ka.length, kb.length);
  const pa = ka.slice(0, len);
  const pb = kb.slice(0, len);
  return pa < pb ? -1 : pa > pb ? 1 : 0;
}

/** Миллисекунды для сортировки; без даты — +∞ (в конец) */
function dateMs(s: string | undefined): number {
  return s ? Date.parse(s) : Number.POSITIVE_INFINITY;
}

// ===================== АТРИБУЦИИ =====================

function phrase(s: string): string {
  return words(s.normalize("NFKC")).join(" ");
}

function containsPhrase(haystack: string, needle: string): boolean {
  return needle.length >= 2 && ` ${haystack} `.includes(` ${needle} `);
}

/** Зоны второго уровня: news.bbc.co.uk → имя сайта bbc, а не co */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "gob", "or"]);

/** Имя сайта из домена: dw.com → "dw", news.bbc.co.uk → "bbc", ru.wikipedia.org → "wikipedia" */
export function siteName(domain: string): string {
  const labels = domain
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")
    .filter(Boolean);
  if (labels.length < 2) return labels[0] ?? "";
  labels.pop();
  if (labels.length >= 2 && SECOND_LEVEL.has(labels[labels.length - 1])) labels.pop();
  return labels[labels.length - 1];
}

/**
 * Фраза называет сайт по имени домена («по данным DW» ↔ dw.com). Только с заглавной буквы:
 * «according to news reports» — не news.md.
 */
function namesSite(cite: string, name: string): boolean {
  const target = words(name);
  if (target.join(" ").length < 2) return false;
  const tokens = cite.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.some(
    (t, i) => /^\p{Lu}/u.test(t) && target.every((w, k) => tokens[i + k]?.toLowerCase() === w),
  );
}

/**
 * «По данным X» указывает на копию, если X совпадает с её издателем или доменом — без регистра, по вхождению
 * целыми словами в любую сторону: "DW" ↔ dw.com, "агентство Reuters" ↔ Reuters; но "AP" ≠ rap.md.
 * Фразы этапа 04 длиннее имени («как сообщает Reuters», «по данным DW») — совпадают по издателю внутри фразы
 * или по имени сайта из домена (с заглавной).
 */
export function citeMatches(cite: string, source: Pick<SourceCopy, "publisher" | "domain">): boolean {
  const c = phrase(cite);
  if (c.length < 2) return false;
  const domain = source.domain.replace(/^www\./i, "");
  return (
    [phrase(source.publisher), phrase(domain)].some((t) => containsPhrase(t, c) || containsPhrase(c, t)) ||
    namesSite(cite, siteName(domain)) ||
    aliasMatches(cite, domain)
  );
}

/**
 * Крупные источники называют по-разному на ru / ro / en: «по данным ЮНФПА», «conform Națiunilor Unite»,
 * «according to the United Nations» — всё это un.org / unfpa.org, хотя ни имя, ни домен в тексте не совпадают.
 * Ключ — сайт (без поддоменов), значение — как его называют.
 */
// границы слова через \p{L}: в JS-регулярках \b не работает с кириллицей («ООН» не нашлось бы)
const ORG_ALIASES: Record<string, RegExp> = {
  "un.org":
    /(?<![\p{L}\p{N}])(?:UN|U\.N\.|United Nations|ONU|Națiunil\p{L}* Unite|Natiunil\p{L}* Unite|ООН|Организаци\p{L}* Объединённых Наций|Организаци\p{L}* Объединенных Наций)(?![\p{L}\p{N}])/u,
  "unfpa.org": /(?<![\p{L}\p{N}])(?:UNFPA|ЮНФПА|Фонд\p{L}* ООН в области народонаселения)(?![\p{L}\p{N}])/u,
  "who.int":
    /(?<![\p{L}\p{N}])(?:WHO|World Health Organi[sz]ation|OMS|Organizați\p{L}* Mondial\p{L}* a Sănătății|ВОЗ|Всемирн\p{L}* организаци\p{L}* здравоохранения)(?![\p{L}\p{N}])/u,
  "nytimes.com": /(?<![\p{L}\p{N}])(?:NYT|New York Times|Нью-Йорк таймс)(?![\p{L}\p{N}])/iu,
  "reuters.com": /(?<![\p{L}\p{N}])(?:Reuters|Рейтер\p{L}*)(?![\p{L}\p{N}])/iu,
  "apnews.com": /(?<![\p{L}\p{N}])(?:AP|Associated Press|Ассошиэйтед Пресс)(?![\p{L}\p{N}])/u,
  "dw.com": /(?<![\p{L}\p{N}])(?:DW|Deutsche Welle|Немецк\p{L}* волн\p{L}*)(?![\p{L}\p{N}])/u,
  "bbc.com": /(?<![\p{L}\p{N}])(?:BBC|Би-би-си)(?![\p{L}\p{N}])/u,
  "tass.ru": /(?<![\p{L}\p{N}])(?:ТАСС|TASS)(?![\p{L}\p{N}])/u,
  "ria.ru": /(?<![\p{L}\p{N}])(?:РИА Новости|RIA Novosti)(?![\p{L}\p{N}])/u,
  "moldpres.md": /(?<![\p{L}\p{N}])(?:Moldpres|Молдпрес)(?![\p{L}\p{N}])/iu,
  "gov.md":
    /(?<![\p{L}\p{N}])(?:Guvernul|Guvern\p{L}*|Правительств\p{L}* (?:Молдовы|Республики Молдова))(?![\p{L}\p{N}])/u,
  "statistica.md":
    /(?<![\p{L}\p{N}])(?:BNS|Biroul Național de Statistică|НБС|Национальн\p{L}* бюро статистики)(?![\p{L}\p{N}])/u,
};

function aliasMatches(cite: string, domain: string): boolean {
  const base = baseDomain(domain);
  const re = ORG_ALIASES[base] ?? (base.endsWith(".gov.md") ? ORG_ALIASES["gov.md"] : undefined);
  return !!re && re.test(cite.normalize("NFKC"));
}

/** news.un.org → un.org, www.bbc.co.uk → bbc.co.uk, msmps.gov.md → gov.md-подобные оставляем целиком */
export function baseDomain(domain: string): string {
  const labels = domain
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")
    .filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const take = SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2;
  return labels.slice(-take).join(".");
}

/**
 * На кого копия ссылается словами: сначала источники от LLM (только этого утверждения, непосредственный —
 * первым), затем фразы-атрибуции этапа 04 из текста копии. Без повторов и без упоминаний самой копии
 * («сообщает NewsMaker» в статье NewsMaker — не ребро к другой статье NewsMaker).
 */
export function copyCites(
  c: Pick<CopyFacts, "source" | "cites"> & Partial<Pick<CopyFacts, "structure">>,
): string[] {
  const seen = new Set<string>();
  // «заявил StratCom» — тоже источник: пересказы одного заявления не должны считаться разными голосами
  const speaker = c.structure?.attributedTo ?? "";
  return [...c.cites, ...c.source.attributions, speaker].filter((cite) => {
    const key = phrase(cite);
    if (key.length < 2 || seen.has(key) || citeMatches(cite, c.source)) return false;
    seen.add(key);
    return true;
  });
}

// ===================== РЁБРА-КАНДИДАТЫ =====================
// Каждая функция отдаёт допустимые по датам рёбра; кандидаты одного потомка — в порядке предпочтения.

/**
 * link: среди внешних ссылок копии (`outboundLinks` из 04) есть url другой копии → confirmed.
 * Родитель не позже потомка, если даты есть у обоих; родитель без даты допустим.
 * Из нескольких — сначала копии с самим утверждением, затем самая поздняя (ближайшая к потомку), без даты — последней.
 */
export function linkEdges(copies: CopyFacts[]): Edge[] {
  const dates = copies.map((c) => validDate(c.source.publishedAt));
  const urls = copies.map((c) => canonicalUrl(c.source.url));
  const byUrl = new Map<string, number[]>();
  urls.forEach((u, i) => byUrl.set(u, [...(byUrl.get(u) ?? []), i]));

  return copies.flatMap((c, child) => {
    const parents = new Set<number>();
    for (const link of c.source.outboundLinks) {
      for (const p of byUrl.get(canonicalUrl(link)) ?? []) {
        // та же страница под другим id — не родитель
        if (urls[p] === urls[child]) continue;
        const pd = dates[p];
        const cd = dates[child];
        if (pd && cd && compareDates(pd, cd) > 0) continue;
        parents.add(p);
      }
    }
    const hasClaim = (i: number) => (copies[i].structure ? 1 : 0);
    const latest = (i: number) => (dates[i] ? Date.parse(dates[i]) : Number.NEGATIVE_INFINITY);
    return [...parents]
      .sort((a, b) => hasClaim(b) - hasClaim(a) || latest(b) - latest(a) || a - b)
      .map((parent): Edge => ({ parent, child, via: "link", confidence: "confirmed" }));
  });
}

/**
 * siteLink: копия ссылается на ДРУГУЮ страницу сайта, который есть среди копий (pravda.com.ua → un.org/…/8-billion,
 * а в копиях — un.org/en/dayof8billion) → probable. Ссылки на свой же сайт не считаются.
 * Родитель обязательно с датой и не позже потомка; из нескольких страниц сайта — с утверждением, самая ранняя.
 */
export function siteLinkEdges(copies: CopyFacts[]): Edge[] {
  const dates = copies.map((c) => validDate(c.source.publishedAt));
  const sites = copies.map((c) => baseDomain(c.source.domain || domainOf(c.source.url)));
  return copies.flatMap((c, child) => {
    const linked = new Set(
      c.source.outboundLinks.map((l) => baseDomain(domainOf(l))).filter((d) => d && d !== sites[child]),
    );
    return copies
      .map((_, p) => p)
      .filter((p) => {
        if (p === child || !linked.has(sites[p])) return false;
        const pd = dates[p];
        const cd = dates[child];
        return !!pd && !(cd && compareDates(pd, cd) > 0);
      })
      .sort(
        (a, b) =>
          (copies[b].structure ? 1 : 0) - (copies[a].structure ? 1 : 0) ||
          dateMs(dates[a]) - dateMs(dates[b]) ||
          a - b,
      )
      .map((parent): Edge => ({ parent, child, via: "link", confidence: "probable" }));
  });
}

/**
 * attribution: «по данным X» (`copyCites`: от LLM и от этапа 04) совпадает с издателем/доменом другой копии → probable.
 * Родитель обязательно с датой и не позже потомка (если у потомка дата есть).
 * Порядок: по порядку cites (непосредственный источник — первым), внутри издателя — самая ранняя копия.
 */
export function attributionEdges(copies: CopyFacts[]): Edge[] {
  const dates = copies.map((c) => validDate(c.source.publishedAt));
  return copies.flatMap((c, child) => {
    const ordered: number[] = [];
    for (const cite of copyCites(c)) {
      const matches = copies
        .map((_, p) => p)
        .filter((p) => {
          if (p === child || ordered.includes(p)) return false;
          const pd = dates[p];
          const cd = dates[child];
          if (!pd || (cd && compareDates(pd, cd) > 0)) return false;
          return citeMatches(cite, copies[p].source);
        })
        .sort((a, b) => dateMs(dates[a]) - dateMs(dates[b]) || a - b);
      ordered.push(...matches);
    }
    return ordered.map((parent): Edge => ({ parent, child, via: "attribution", confidence: "probable" }));
  });
}

/**
 * duplicate: тексты почти совпадают (порог по методу похожести) → probable.
 * Нужны даты у обоих; родитель — более ранний (при равных датах — раньше во входном списке).
 * Из нескольких более ранних — самый похожий.
 */
export function duplicateEdges(
  copies: CopyFacts[],
  similarity: Similarity,
  /** Сколько редких деталей делят две копии: важнее похожести (см. sharedRareDetails) */
  shared: (a: number, b: number) => number = () => 0,
): Edge[] {
  const dates = copies.map((c) => validDate(c.source.publishedAt));
  const threshold = similarity.method === "embeddings" ? DUP_THRESHOLD : SHINGLE_THRESHOLD;
  const sim = (a: number, b: number) => similarity.pairs[a]?.[b] ?? 0;

  return copies.flatMap((_, child) => {
    const cd = dates[child];
    if (!cd) return [];
    return copies
      .map((__, p) => p)
      .filter((p) => {
        const pd = dates[p];
        if (p === child || !pd || sim(p, child) < threshold) return false;
        const cmp = compareDates(pd, cd);
        return cmp < 0 || (cmp === 0 && p < child);
      })
      .sort((a, b) => shared(b, child) - shared(a, child) || sim(b, child) - sim(a, child) || a - b)
      .map((parent): Edge => ({ parent, child, via: "duplicate", confidence: "probable" }));
  });
}

/** Меньше копий с утверждением — редкость посчитать не из чего */
const MIN_COPIES_FOR_RARITY = 3;
/** Столько общих редких деталей дают ребро и без похожего текста (например, перевод) */
const MIN_SHARED_FOR_EDGE = 2;

/** Числа и места копии в сравнимом виде. Этап 05 приводит места к языку утверждения */
function details(s: ClaimStructure): Set<string> {
  const numbers = s.numbers.flatMap((n) => n.value.replace(",", ".").match(/\d+(?:\.\d+)?/g) ?? []);
  return new Set([...numbers.map((n) => `#${n}`), ...s.places.map((p) => phrase(p).slice(0, 6))]);
}

/**
 * Сколько РЕДКИХ деталей делят две копии. Совпадение общих фактов ничего не доказывает, а одна и та же
 * редкая деталь, особенно ошибка, выдаёт заимствование (Dong et al., VLDB 2009).
 * Редкая — есть не больше чем у трети копий с утверждением, но минимум у двух.
 */
export function sharedRareDetails(copies: CopyFacts[]): (a: number, b: number) => number {
  const sets = copies.map((c) => (c.structure ? details(c.structure) : new Set<string>()));
  const structured = copies.filter((c) => c.structure).length;
  if (structured < MIN_COPIES_FOR_RARITY) return () => 0;
  const counts = new Map<string, number>();
  for (const set of sets) for (const d of set) counts.set(d, (counts.get(d) ?? 0) + 1);
  const limit = Math.max(2, Math.floor(structured / 3));
  return (a, b) => [...sets[a]].filter((d) => sets[b].has(d) && (counts.get(d) ?? 0) <= limit).length;
}

/** Длина фрагмента: 7 слов реже совпадают случайно, чем 5 (Nicholls, 2019) */
export const REUSE_GRAM = 7;
/**
 * Сколько редких фрагментов дают ребро. Доля от страницы не подходит: цитата занимает малую часть длинной статьи.
 * Живые страницы: настоящие заимствования от 12 общих фрагментов, названия конвенций и шаблоны до 5.
 */
export const REUSE_MIN_GRAMS = 10;

/** Фрагмент есть больше чем у такой доли копий: шаблон или общая формула, а не след заимствования */
const COMMON_SHINGLE_SHARE = 0.6;
const MIN_COPIES_FOR_COMMON = 5;

/** Убирает слишком частые фрагменты: важны редкие совпадения, а не общие слова (Nicholls, 2019) */
export function rareShingles(sets: Set<string>[]): Set<string>[] {
  if (sets.length < MIN_COPIES_FOR_COMMON) return sets;
  const counts = new Map<string, number>();
  for (const set of sets) for (const s of set) counts.set(s, (counts.get(s) ?? 0) + 1);
  const limit = sets.length * COMMON_SHINGLE_SHARE;
  return sets.map((set) => new Set([...set].filter((s) => (counts.get(s) ?? 0) <= limit)));
}

/** PDF: при извлечении текста совпадает служебная разметка файла */
const BINARY_DOCUMENT = /\.pdf($|[?#])/i;

/**
 * Перепечатки и общие цитаты по полному тексту страниц. Выдержки у копий вырезаны по-разному, поэтому их
 * эмбеддинги не видят даже почти дословный текст. Считаем общие редкие фрагменты, а не долю страницы.
 * Родитель — более ранний; при равных датах направление неизвестно, берём порядок входа. Всегда probable.
 */
export function textReuseEdges(copies: CopyFacts[]): Edge[] {
  const dates = copies.map((c) => validDate(c.source.publishedAt));
  const sets = rareShingles(
    copies.map((c) =>
      BINARY_DOCUMENT.test(c.source.url) ? new Set<string>() : shingles(c.source.fullText ?? "", REUSE_GRAM),
    ),
  );
  const reuse = (a: number, b: number) => {
    let shared = 0;
    for (const s of sets[a]) if (sets[b].has(s)) shared++;
    return shared;
  };
  return copies.flatMap((_, child) => {
    const cd = dates[child];
    if (!cd) return [];
    return copies
      .map((__, p) => ({ p, score: p === child ? 0 : reuse(p, child) }))
      .filter(({ p, score }) => {
        const pd = dates[p];
        if (!pd || score < REUSE_MIN_GRAMS) return false;
        const cmp = compareDates(pd, cd);
        return cmp < 0 || (cmp === 0 && p < child);
      })
      .sort((a, b) => b.score - a.score || a.p - b.p)
      .map(({ p }): Edge => ({ parent: p, child, via: "duplicate", confidence: "probable" }));
  });
}

/** Рёбра по редким деталям: ловят перепечатки, чей текст не похож (перевод, рерайт). Всегда probable */
export function detailEdges(copies: CopyFacts[], shared: (a: number, b: number) => number): Edge[] {
  const dates = copies.map((c) => validDate(c.source.publishedAt));
  return copies.flatMap((_, child) => {
    const cd = dates[child];
    if (!cd) return [];
    return copies
      .map((__, p) => p)
      .filter((p) => {
        const pd = dates[p];
        return p !== child && !!pd && compareDates(pd, cd) < 0 && shared(p, child) >= MIN_SHARED_FOR_EDGE;
      })
      .sort((a, b) => shared(b, child) - shared(a, child) || a - b)
      .map((parent): Edge => ({ parent, child, via: "duplicate", confidence: "probable" }));
  });
}

/** Источник назван, но ничего конкретного не сообщает: «очевидцы» не объединяют голоса */
const VAGUE_CITE =
  /^(источник|очевид|эксперт|журналист|пользоват|сми|медиа|surse|sursa|martor|expert|presa|media|source|witness)/iu;
const CITE_MARKER =
  /^(по данным|по информации|по словам|со ссылкой на|как сообщает|как сообщил[аио]?|сообщает|сообщил[аио]?|заявил[аио]?|potrivit|conform|citat de|a declarat|a anunțat|according to|reported by|citing|said)\s+/iu;

/** Есть имя собственное и фраза короткая: «lui» или «украинский посол в» — обрывки, а не источник */
function isProperName(name: string): boolean {
  return /(^|\s)\p{Lu}/u.test(name) && name.split(/\s+/).length <= 4;
}

/** «по данным мэрии Кишинёва» и «мэрия Кишинёва» → один ключ: начала слов без окончаний */
export function citedKey(cite: string): string {
  return words(cite.replace(CITE_MARKER, ""))
    .slice(0, 3)
    .map((w) => w.slice(0, 4))
    .join(" ");
}

/** Разбор не пересказывает то, что разбирает, а упоминание никого не копирует: это не связь «кто у кого взял» */
function derivable(copies: CopyFacts[], edge: Edge): boolean {
  const parent = copies[edge.parent].relation;
  const child = copies[edge.child].relation;
  if (parent === "mentions" || child === "mentions") return false;
  return (parent === "debunks") === (child === "debunks");
}

/** Копии одного сайта: связь внутри него ничего не говорит о распространении */
function sameSite(copies: CopyFacts[], edge: Edge): boolean {
  const site = (c: CopyFacts) => baseDomain(c.source.domain || domainOf(c.source.url));
  return site(copies[edge.parent]) === site(copies[edge.child]);
}

/** Фактчекеры Молдовы и региона: многих нет в справочнике доменов этапа 04 */
const FACT_CHECK_HOST =
  /(^|\.)(mythdetector\.com|stopfals\.md|veridica\.ro|euvsdisinfo\.eu|stopfake\.org|provereno\.media|factcheck\.ge|factual\.ro)$/i;
/** Заголовок разбора. Слова из текста не берём: фейк может сам писать про «фейки» */
const DEBUNK_TITLE =
  /фейк|дезинформ|опроверг|разоблач|правда ли|\bfake\b|\bfals\b|\bfalsuri|dezinform|dezmin[tț]|infirm|denatur|fact.?check|debunk|\bhoax\b|manipul[aă]r/iu;

/** Отношение LLM ошибается на разборах, поэтому явные признаки проверяет код */
export function checkedRelation(
  source: Pick<SourceCopy, "domain" | "sourceType" | "title">,
  relation: CopyRelation | undefined,
): CopyRelation | undefined {
  if (!relation) return relation;
  const explicit =
    source.sourceType === "fact_checker" ||
    FACT_CHECK_HOST.test(source.domain) ||
    DEBUNK_TITLE.test(source.title);
  return explicit ? "debunks" : relation;
}

/** Публикация может быть началом истории: разбор и упоминание не могут */
function canBeOrigin(c: CopyFacts): boolean {
  return c.relation !== "debunks" && c.relation !== "mentions";
}

/** Источник, на который копия ссылается, но которого нет среди копий; null — такого нет */
function unresolvedCite(index: number, copies: CopyFacts[]): string | null {
  for (const cite of copyCites(copies[index])) {
    const name = cite.replace(CITE_MARKER, "");
    if (VAGUE_CITE.test(name) || citedKey(cite).length < 3 || !isProperName(name)) continue;
    if (copies.some((c) => citeMatches(cite, c.source))) continue;
    return citedKey(cite);
  }
  return null;
}

/**
 * Группа независимости копии. Отличия от простого «корень ветки»:
 *  - разбор и то, что он разбирает, — разные голоса, даже если разбор ссылается на фейк;
 *  - копии, которые ссылаются на один не найденный источник, — один голос, а не несколько;
 *  - то же для разборов, но отдельной группой: у них другая сторона.
 */
export function independentGroup(index: number, copies: CopyFacts[], parents: (Edge | null)[]): string {
  const debunks = (i: number) => copies[i].relation === "debunks";
  let top = index;
  for (let edge = parents[top]; edge && debunks(top) === debunks(edge.parent); edge = parents[top]) {
    top = edge.parent;
  }
  const cited = unresolvedCite(top, copies);
  if (!cited) return copies[top].source.id;
  // разборы одного не найденного заявления — один голос, но не вместе с теми, кто повторяет утверждение
  return debunks(top) ? `debunk-cited:${cited}` : `cited:${cited}`;
}

// ===================== ОДИН РОДИТЕЛЬ =====================

/**
 * Не больше одного родителя на узел. Уровни по очереди: все ссылки, потом атрибуции, потом дубли —
 * более надёжное ребро никогда не вытесняется менее надёжным. Внутри уровня потомки — в порядке `order`
 * (по дате), у потомка — первый кандидат, который не замыкает цикл.
 */
export function chooseParents(count: number, order: number[], tiers: Edge[][]): (Edge | null)[] {
  const parent = new Array<Edge | null>(count).fill(null);
  const isAncestorOrSelf = (node: number, of: number) => {
    for (let x: number | undefined = of; x !== undefined; x = parent[x]?.parent) if (x === node) return true;
    return false;
  };
  for (const tier of tiers) {
    const byChild = new Map<number, Edge[]>();
    for (const e of tier) byChild.set(e.child, [...(byChild.get(e.child) ?? []), e]);
    for (const child of order) {
      if (parent[child]) continue;
      const edge = byChild.get(child)?.find((e) => !isAncestorOrSelf(child, e.parent));
      if (edge) parent[child] = edge;
    }
  }
  return parent;
}

/** Порядок таймлайна: по дате; без даты — после датированных; при равенстве — как во входе */
export function timelineOrder(copies: Pick<CopyFacts, "source">[]): number[] {
  const ms = copies.map((c) => dateMs(validDate(c.source.publishedAt)));
  return copies.map((_, i) => i).sort((a, b) => (ms[a] === ms[b] ? a - b : ms[a] - ms[b]));
}

/**
 * Родитель видео: самая похожая на утверждение копия, в которой утверждение есть и которая опубликована
 * не позже видео (если дата видео известна — у копии дата тоже нужна). Похожесть 0 — не родитель.
 */
export function videoParent(copies: CopyFacts[], video: VideoFacts, toClaim: number[]): number | null {
  const videoDate = validDate(video.publishedAt);
  let best: number | null = null;
  copies.forEach((c, i) => {
    if (!c.structure || !canBeOrigin(c) || !((toClaim[i] ?? 0) > 0)) return;
    if (videoDate) {
      const d = validDate(c.source.publishedAt);
      if (!d || compareDates(d, videoDate) > 0) return;
    }
    if (best === null || toClaim[i] > toClaim[best]) best = i;
  });
  return best;
}

const DAY_MS = 86_400_000;
/** Настолько раньше всплеска страница считается предысторией, а не началом этого эпизода */
const PREHISTORY_GAP_DAYS = 90;
/** Всплеск: столько разных сайтов за BURST_DAYS */
const BURST_SITES = 3;
const BURST_DAYS = 30;

/** Дате только от поисковика не верим: это бывает дата обхода или правки */
function trustedDate(c: CopyFacts): boolean {
  return !!validDate(c.source.publishedAt) && c.source.dateSource !== "search";
}

/** Есть ли после даты всплеск публикаций на разных сайтах: значит, идёт отдельный свежий эпизод */
function laterBurst(after: number, copies: CopyFacts[]): boolean {
  const dated = copies
    .filter((c) => c.structure && canBeOrigin(c) && dateMs(validDate(c.source.publishedAt)) < Infinity)
    .map((c) => ({
      at: dateMs(c.source.publishedAt),
      site: baseDomain(c.source.domain || domainOf(c.source.url)),
    }))
    .filter((c) => c.at - after > PREHISTORY_GAP_DAYS * DAY_MS);
  return dated.some(
    (start) =>
      new Set(
        dated.filter((c) => c.at >= start.at && c.at - start.at <= BURST_DAYS * DAY_MS).map((c) => c.site),
      ).size >= BURST_SITES,
  );
}

/**
 * Предыстория: старая страница той же темы, ничем не связанная со свежим всплеском публикаций (конфликт начался
 * в 2018, а проверяем эпизод 2026). Она остаётся на таймлайне, но началом этого эпизода не считается.
 * Старая новость, выданная за новую, сюда не попадает: у неё нет свежего всплеска или есть связь с копиями.
 */
function isPrehistory(
  index: number,
  copies: CopyFacts[],
  parents: (Edge | null)[],
  shared: (a: number, b: number) => number,
): boolean {
  const linked =
    !!parents[index] ||
    parents.some((edge) => edge?.parent === index) ||
    copies.some((_, other) => other !== index && shared(index, other) > 0);
  return !linked && laterBurst(dateMs(copies[index].source.publishedAt), copies);
}

/**
 * Корень — верх самой ранней ветви. Самая ранняя копия могла сослаться на источник, у которого даты нет:
 * тогда начало истории он, а не более поздняя страница без родителя (живой прогон: родитель трёх копий без даты).
 * Кандидат — копия с надёжной датой; нет такой — корня нет: лучше честно не назвать, чем назвать ложный.
 */
export function earliestBranchTop(
  order: number[],
  copies: CopyFacts[],
  parents: (Edge | null)[],
  shared: (a: number, b: number) => number = () => 0,
): number | undefined {
  const first = order.find(
    (i) =>
      copies[i].structure !== null &&
      canBeOrigin(copies[i]) &&
      trustedDate(copies[i]) &&
      !isPrehistory(i, copies, parents, shared),
  );
  if (first === undefined) return undefined;
  let top = first;
  for (let edge = parents[top]; edge && canBeOrigin(copies[edge.parent]); edge = parents[top])
    top = edge.parent;
  return top;
}

/** Не найденный источник, на который указывают минимум две копии: показываем его узлом, а не выдумываем корень */
function hiddenSourcesOf(copies: CopyFacts[], voteGroups: Record<SourceId, string>): HiddenSource[] {
  const groups = new Map<string, CopyFacts[]>();
  for (const c of copies) {
    const id = voteGroups[c.source.id];
    if (id?.startsWith("cited:")) groups.set(id, [...(groups.get(id) ?? []), c]);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length >= 2)
    .map(([id, members]) => ({
      id,
      name: citedNameOf(id, members),
      copyIds: members.map((c) => c.source.id),
    }));
}

function citedNameOf(id: string, members: CopyFacts[]): string {
  const key = id.slice("cited:".length);
  for (const c of members) {
    const cite = copyCites(c).find((x) => citedKey(x) === key);
    if (cite) return cite.replace(CITE_MARKER, "");
  }
  return key;
}

// ===================== ДЕРЕВО =====================

export interface BuildTreeParams {
  claimId: ClaimId;
  /** Уникальные по id */
  copies: CopyFacts[];
  video: VideoFacts;
  similarity: Similarity;
  /** TRACE_SEARCH=on: редкие детали в выборе родителя и группы голосов с учётом типа связи */
  traceMode?: boolean;
}

export function buildTree({
  claimId,
  copies,
  video,
  similarity,
  traceMode = false,
}: BuildTreeParams): ProvenanceTree {
  const order = timelineOrder(copies);
  const shared = traceMode ? sharedRareDetails(copies) : () => 0;
  const elsewhere = (edges: Edge[]) => edges.filter((e) => !sameSite(copies, e));
  const tiers = traceMode
    ? [
        linkEdges(copies),
        attributionEdges(copies),
        siteLinkEdges(copies),
        elsewhere(textReuseEdges(copies)),
        elsewhere(duplicateEdges(copies, similarity, shared)),
        elsewhere(detailEdges(copies, shared)),
      ].map((tier) => tier.filter((e) => derivable(copies, e)))
    : [
        linkEdges(copies),
        attributionEdges(copies),
        siteLinkEdges(copies),
        duplicateEdges(copies, similarity),
      ];
  const parents = chooseParents(copies.length, order, tiers);
  const idOf = (i: number): SourceId => copies[i].source.id;

  const nodes: TreeNode[] = order.map((i) => {
    const { source, structure, relation } = copies[i];
    const date = validDate(source.publishedAt);
    const edge = parents[i];
    return {
      id: source.id,
      url: source.url,
      title: source.title,
      publisher: source.publisher,
      domain: source.domain,
      ...(date ? { publishedAt: date } : {}),
      parentId: edge ? idOf(edge.parent) : null,
      via: edge?.via ?? null,
      confidence: edge?.confidence ?? null,
      structure,
      ...(relation ? { relation } : {}),
    };
  });

  const vp = videoParent(copies, video, similarity.toClaim);
  const videoDate = validDate(video.publishedAt);
  nodes.push({
    id: VIDEO_NODE_ID,
    url: video.url,
    title: video.title,
    publisher: VIDEO_PUBLISHER,
    domain: domainOf(video.url),
    ...(videoDate ? { publishedAt: videoDate } : {}),
    parentId: vp === null ? null : idOf(vp),
    via: vp === null ? null : "duplicate",
    confidence: vp === null ? null : "probable",
    structure: video.structure,
  });

  // order уже по дате: первый подходящий — самый ранний
  const root = traceMode
    ? earliestBranchTop(order, copies, parents, shared)
    : order.find(
        (i) =>
          !parents[i] &&
          copies[i].structure !== null &&
          canBeOrigin(copies[i]) &&
          validDate(copies[i].source.publishedAt),
      );

  const voteGroups: Record<SourceId, string> = {};
  copies.forEach((c, i) => {
    if (traceMode) {
      voteGroups[c.source.id] = independentGroup(i, copies, parents);
      return;
    }
    let top = i;
    for (let edge = parents[top]; edge; edge = parents[top]) top = edge.parent;
    voteGroups[c.source.id] = idOf(top);
  });

  const hiddenSources = traceMode ? hiddenSourcesOf(copies, voteGroups) : [];
  return {
    claimId,
    rootId: root === undefined ? null : idOf(root),
    nodes,
    voteGroups,
    ...(hiddenSources.length ? { hiddenSources } : {}),
  };
}
