/**
 * Шаг 3: из всех найденных страниц собираем FoundSource и отбираем maxSources с максимальным разнообразием:
 * разные издатели, типы, страны, языки и хотя бы один источник из запроса на опровержение.
 */
import type { LanguageCode } from "@news/contracts";
import { lookupDomain, normalizeHost, type DomainInfo } from "./domains.ts";
import type { Candidate } from "./engines.ts";
import {
  cleanText,
  detectLanguage,
  hits,
  keywordStems,
  pickExcerpt,
  pickSnippet,
  proseShare,
  stemSet,
} from "./text.ts";
import type { FoundSource } from "./types.ts";

/** Страницы, где совпало меньше этой доли ключевых слов, считаем не по теме */
const MIN_MATCH = 0.25;
/** …и не меньше стольких слов, если ключевых слов хватает: одно общее слово — не тема */
const MIN_HITS = 2;
/** Бонус за «опровергающий» запрос — только странице, которая точно про этот тезис */
const REFUTE_BONUS_MIN_MATCH = 0.5;
/** Штраф странице, где почти нет связного текста: рубрика, лента, список заголовков, а не статья */
const LISTING_PENALTY = 0.15;
const MIN_PROSE_SHARE = 0.3;
/** Больше текста не разбираем: дальше обычно комментарии и подвал, а время — синхронное */
const MAX_TEXT = 200_000;

export interface Enriched {
  candidate: Candidate;
  info: DomainInfo;
  domain: string;
  language: LanguageCode;
  excerpt: string;
  snippet: string;
  /** 0..1 — доля ключевых слов тезиса/запроса в тексте */
  match: number;
  /** Итоговый вес без учёта разнообразия */
  base: number;
}

/** Одна страница могла найтись несколькими запросами — оставляем лучший результат и все запросы. */
export function dedupe(candidates: Candidate[]): Candidate[] {
  const byUrl = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = canonicalUrl(c.url);
    if (!key) continue;
    const prev = byUrl.get(key);
    if (!prev) byUrl.set(key, c);
    else {
      const best = c.relevance > prev.relevance ? c : prev;
      byUrl.set(key, { ...best, queries: [...prev.queries, ...c.queries] });
    }
  }
  return [...byUrl.values()];
}

export function enrich(c: Candidate, claimStems: string[]): Enriched | null {
  const domain = normalizeHost(new URL(c.url).hostname);
  const known = lookupDomain(domain, c.fallbackType);
  const info: DomainInfo = c.preset
    ? { ...known, type: "fact_checker", publisher: c.preset.publisher ?? known.publisher }
    : {
        ...known,
        publisher: known.publisher === domain ? publisherFromTitle(c.title, domain) : known.publisher,
      };

  // запрос мог быть на другом языке, чем тезис — засчитываем лучшее из совпадений
  const queryStems = c.queries.map((q) => keywordStems(q.text));
  const present = stemSet(`${c.title}\n${c.text.slice(0, MAX_TEXT)}`);
  const match = Math.max(
    0,
    ...[claimStems, ...queryStems].map((stems) => {
      const n = hits(present, stems);
      return n >= Math.min(MIN_HITS, stems.length) && stems.length ? n / stems.length : 0;
    }),
  );
  if (match < MIN_MATCH) return null;

  const stems = [...new Set([claimStems, ...queryStems].flat())];
  const excerpt = c.preset?.excerpt ?? pickExcerpt(c.text, stems);
  const snippet = c.preset?.snippet || pickSnippet(excerpt, stems);
  return {
    candidate: c,
    info,
    domain,
    language: c.preset ? c.language : detectLanguage(excerpt, c.language),
    excerpt,
    snippet,
    match,
    base:
      0.45 * clamp01(c.relevance) +
      0.35 * info.reliability +
      0.2 * match -
      (!c.preset && proseShare(excerpt) < MIN_PROSE_SHARE ? LISTING_PENALTY : 0),
  };
}

/** Жадный отбор: на каждом шаге берём источник с лучшим весом + бонусом за новизну точки зрения. */
export function selectDiverse(items: Enriched[], max: number): Enriched[] {
  const pool = [...items];
  const picked: Enriched[] = [];
  while (picked.length < max) {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((e, i) => {
      const site = registrableDomain(e.domain);
      if (picked.some((p) => registrableDomain(p.domain) === site || p.info.publisher === e.info.publisher))
        return;
      const score = e.base + diversityBonus(e, picked);
      if (score > bestScore) [best, bestScore] = [i, score];
    });
    if (best < 0) break;
    picked.push(pool.splice(best, 1)[0]);
  }
  return picked;
}

function diversityBonus(e: Enriched, picked: Enriched[]): number {
  if (!picked.length) return 0;
  let bonus = 0;
  if (!picked.some((p) => p.info.type === e.info.type)) bonus += 0.15;
  if (e.info.country && !picked.some((p) => p.info.country === e.info.country)) bonus += 0.1;
  if (!picked.some((p) => p.language === e.language)) bonus += 0.1;
  if (isRefuting(e) && e.match >= REFUTE_BONUS_MIN_MATCH && !picked.some(isRefuting)) bonus += 0.1;
  return bonus;
}

function isRefuting(e: Enriched): boolean {
  return e.candidate.queries.some((q) => q.intent === "refute");
}

export function toFoundSource(e: Enriched, id: string, retrievedAt: string): FoundSource {
  const { publishedAt, dateFrom } = resolveDate(e.candidate);
  const links = extractLinks(e.candidate.text, e.candidate.url);
  return {
    id,
    url: e.candidate.url,
    title: cleanText(e.candidate.title) || e.info.publisher,
    publisher: e.info.publisher,
    domain: e.domain,
    sourceType: e.info.type,
    publishedAt,
    dateFrom,
    links,
    language: e.language,
    country: e.info.country,
    excerpt: e.excerpt,
    snippet: e.snippet,
    domainReliability: e.info.reliability,
    retrievedAt,
  };
}

function resolveDate(c: Candidate): { publishedAt?: string; dateFrom?: "search" | "page" | "url" | null } {
  const fromSearch = toIso(c.publishedAt);
  if (fromSearch) return { publishedAt: fromSearch, dateFrom: "search" };

  // Из URL: /2023/03/14/ или /2023-03-14/ или 14-03-2023
  const urlMatch = c.url.match(/(?:^|[/-])(20\d\d)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])(?:[/-]|$)/);
  if (urlMatch) {
    const [, y, m, d] = urlMatch;
    const iso = toIso(`${y}-${m}-${d}T00:00:00Z`);
    if (iso) return { publishedAt: iso, dateFrom: "url" };
  }

  // Из текста страницы / сниппета (первые 2000 символов)
  const textSample = c.text.slice(0, 2000);
  const textIsoMatch = textSample.match(/\b(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (textIsoMatch) {
    const [, y, m, d] = textIsoMatch;
    const iso = toIso(`${y}-${m}-${d}T00:00:00Z`);
    if (iso) return { publishedAt: iso, dateFrom: "page" };
  }
  const textRuMatch = textSample.match(/\b(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.(20\d\d)\b/);
  if (textRuMatch) {
    const [, d, m, y] = textRuMatch;
    const iso = toIso(`${y}-${m}-${d}T00:00:00Z`);
    if (iso) return { publishedAt: iso, dateFrom: "page" };
  }

  return { publishedAt: undefined, dateFrom: null };
}

function extractLinks(text: string, selfUrl: string): string[] {
  let selfHost: string;
  try {
    selfHost = normalizeHost(new URL(selfUrl).hostname);
  } catch {
    return [];
  }

  const links = new Set<string>();
  const matches = text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g);
  for (const m of matches) {
    const raw = m[0].replace(/[.,;:!?)]+$/, "");
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const host = normalizeHost(parsed.hostname);
      if (host === selfHost || /\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?)$/i.test(parsed.pathname)) {
        continue;
      }
      links.add(parsed.origin + parsed.pathname);
    } catch {
      // игнорируем некорректные URL
    }
  }
  return [...links].slice(0, 20);
}

function canonicalUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|fbclid$|gclid$)/.test(key)) url.searchParams.delete(key);
    return `${normalizeHost(url.hostname)}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return undefined;
  }
}

/**
 * «Заголовок статьи | Издание» → «Издание» для доменов, которых нет в справочнике.
 * Хвост принимаем, только если он похож на домен: «Война в Украине - главное за сутки» — это не издатель.
 */
function publisherFromTitle(title: string, domain: string): string {
  const tail = title.match(/\s[|–—-]\s([^|–—-]{2,40})$/)?.[1].trim();
  if (!tail) return domain;
  const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const site = key(registrableDomain(domain).split(".")[0]);
  const name = key(tail);
  return name.length >= 2 && (site.includes(name) || name.includes(site)) ? tail : domain;
}

/** Зоны второго уровня, под которыми регистрируют домены: bbc.co.uk, kyiv-news.com.ua */
const SECOND_LEVEL = new Set([
  ...["co", "com", "org", "net", "ac", "edu", "or", "ne"],
  // национальные госзоны: economie.gouv.fr и interieur.gouv.fr — разные ведомства, а не один сайт
  ...["gov", "gouv", "gob", "gub", "gc", "govt", "go", "gv", "mil"],
]);

/** edition.cnn.com, m.cnn.com → cnn.com; news.bbc.co.uk → bbc.co.uk (без public suffix list, эвристика) */
export function registrableDomain(host: string): string {
  const labels = host.split(".");
  const n = labels.length;
  const take = n >= 3 && labels[n - 1].length === 2 && SECOND_LEVEL.has(labels[n - 2]) ? 3 : 2;
  return labels.slice(-take).join(".");
}

function toIso(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
