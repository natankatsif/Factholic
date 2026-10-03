/**
 * Построение дерева первоисточника — чистые функции без LLM и сети (тестируются отдельно, tree.test.ts).
 * На входе — копии из этапа 04 (внешние ссылки, «по данным …» из текста) со структурой и атрибуциями от LLM
 * (шаг 1) и похожесть текстов (эмбеддинги или шинглы).
 * Внутри копии адресуются индексами во входном массиве; id появляются только в выходе.
 */
import type { ClaimId, ISODateString, SourceId } from "@news/contracts";
import type { Claim, ClaimStructure } from "../03-claim-extraction/types.ts";
import type { SourceCopy } from "../04-source-search/types.ts";
import { VIDEO_NODE_ID, type ProvenanceTree, type ProvenanceVia, type TreeNode } from "./types.ts";

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
  copies: Pick<SourceCopy, "publishedAt">[],
  toClaim: number[],
  max = MAX_COPIES,
): number[] {
  const dated = (i: number) => (validDate(copies[i].publishedAt) ? 1 : 0);
  return copies
    .map((_, i) => i)
    .sort((a, b) => dated(b) - dated(a) || (toClaim[b] ?? 0) - (toClaim[a] ?? 0) || a - b)
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
export function copyCites(c: Pick<CopyFacts, "source" | "cites">): string[] {
  const seen = new Set<string>();
  return [...c.cites, ...c.source.attributions].filter((cite) => {
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
export function duplicateEdges(copies: CopyFacts[], similarity: Similarity): Edge[] {
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
      .sort((a, b) => sim(b, child) - sim(a, child) || a - b)
      .map((parent): Edge => ({ parent, child, via: "duplicate", confidence: "probable" }));
  });
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
    if (!c.structure || !((toClaim[i] ?? 0) > 0)) return;
    if (videoDate) {
      const d = validDate(c.source.publishedAt);
      if (!d || compareDates(d, videoDate) > 0) return;
    }
    if (best === null || toClaim[i] > toClaim[best]) best = i;
  });
  return best;
}

// ===================== ДЕРЕВО =====================

export interface BuildTreeParams {
  claimId: ClaimId;
  /** Уникальные по id */
  copies: CopyFacts[];
  video: VideoFacts;
  similarity: Similarity;
}

export function buildTree({ claimId, copies, video, similarity }: BuildTreeParams): ProvenanceTree {
  const order = timelineOrder(copies);
  const parents = chooseParents(copies.length, order, [
    linkEdges(copies),
    attributionEdges(copies),
    siteLinkEdges(copies),
    duplicateEdges(copies, similarity),
  ]);
  const idOf = (i: number): SourceId => copies[i].source.id;

  const nodes: TreeNode[] = order.map((i) => {
    const { source, structure } = copies[i];
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
  const root = order.find(
    (i) => !parents[i] && copies[i].structure !== null && validDate(copies[i].source.publishedAt),
  );

  const voteGroups: Record<SourceId, string> = {};
  copies.forEach((c, i) => {
    let top = i;
    for (let edge = parents[top]; edge; edge = parents[top]) top = edge.parent;
    voteGroups[c.source.id] = idOf(top);
  });

  return { claimId, rootId: root === undefined ? null : idOf(root), nodes, voteGroups };
}
