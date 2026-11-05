/**
 * Режим copies: ВСЕ публикации об утверждении — сырьё для дерева первоисточника (этап backend-2).
 *
 * Отличия от sources (select.ts):
 *  - не отсеиваем перепечатки одного издателя: для дерева важна каждая копия;
 *  - не ограничиваем свежестью: старый контент — как раз то, что ищем;
 *  - у каждой копии: дата, внешние ссылки из текста, «по данным …» — по ним строятся рёбра дерева.
 *
 *  Раунд 1: до 3 запросов о событии (ro/ru/en, приоритет молдавских сайтов)
 *  Раунд 2: «самое раннее упоминание» — тот же поиск с end_date раньше самой старой найденной копии
 *  Фильтр: LLM убирает копии про другое событие того же типа (same-event.ts)
 */
import type { ISODateString, LanguageCode } from "@news/contracts";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import type { Claim } from "../03-claim-extraction/types.ts";
import {
  claimCountry,
  mentionsAnchor,
  normalizeTerm,
  pickAnchors,
  searchSites,
  type Anchor,
  type AnchorPage,
} from "./anchors.ts";
import { normalizeHost } from "./domains.ts";
import { limited, searchCredits, tavilyPost, throttle, type Candidate } from "./engines.ts";
import type { PlannedQuery } from "./queries.ts";
import { forEachPage, htmlToMarkdown, openPage } from "./pages.ts";
import { filterSameEvent } from "./same-event.ts";
import { dedupe, enrich, registrableDomain, type Enriched } from "./select.ts";
import { cleanText, hits, keywordStems, stemSet } from "./text.ts";
import {
  citedName,
  claimPassages,
  exactQuery,
  MAX_CITATIONS_PER_ROUND,
  MAX_LINKS_PER_ROUND,
  MAX_PHRASES_PER_ROUND,
  MAX_TRACE_ROUNDS,
  oldestDate,
  openCitations,
  openLanguages,
  openLinks,
  outOfBudget,
  quotedPhrases,
  withoutNumbers,
} from "./traces.ts";
import type { SourceCopy, Trace, TraceReport } from "./types.ts";

const MAX_COPY_QUERIES = 3;
const MAX_COPIES = 25;
/** Сколько страниц видит фильтр «та же история»: лимит MAX_COPIES действует уже после него */
const MAX_POOL = 40;
/** Сколько страниц без даты докачиваем, чтобы найти дату в разметке (каждая — отдельный запрос) */
const MAX_PAGE_DATE_FETCHES = 8;
const PAGE_TIMEOUT_MS = 8_000;
const MAX_LINKS = 20;
const MAX_ATTRIBUTIONS = 8;

/** Соцсети и видеохостинги — не публикации, а такой же пользовательский контент (как в engines.ts) */
const EXCLUDE_DOMAINS = ["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "pinterest.com"];

interface CopyHit {
  candidate: Candidate;
  links: string[];
  earliest: boolean;
  /** Найдена по следу из другой копии */
  traced?: boolean;
}

export interface CopiesResult {
  copies: SourceCopy[];
  traces?: TraceReport;
}

/** Точка входа этапа: прежний поиск или поиск по следам (TRACE_SEARCH=on) */
export function findCopiesWithTraces(
  claim: Claim,
  planned: PlannedQuery[],
  ctx: StageContext,
  traceMode = config.experiments.traceSearch,
  /** Страницы основного поиска: из них тоже берём зацепки */
  sourcePages: Promise<Enriched[]> = Promise.resolve([]),
  /** Дополнительный источник первого круга: он есть только в повторных заходах */
  extraSearch?: (q: PlannedQuery) => Promise<Candidate[]>,
): Promise<CopiesResult> {
  const country = claimCountry(claim);
  const regional = planned.map((q) => (country ? { ...q, country } : q));
  return traceMode
    ? traceCopies(claim, regional, ctx, sourcePages, extraSearch)
    : findCopies(claim, regional, ctx).then((copies) => ({ copies }));
}

export async function findCopies(
  claim: Claim,
  planned: PlannedQuery[],
  ctx: StageContext,
): Promise<SourceCopy[]> {
  // запросы-описания события; «опровержения» не нужны — нужны сами перепечатки
  const queries = planned.filter((q) => q.intent !== "refute").slice(0, MAX_COPY_QUERIES);
  if (!queries.length) return [];

  const t = [Date.now()];
  const lap = () => {
    t.push(Date.now());
    return `${((t.at(-1)! - t.at(-2)!) / 1000).toFixed(1)}с`;
  };
  const laps: string[] = [];

  // Раунд 1
  const round1 = await Promise.allSettled(queries.map((q) => limited(() => tavilyCopies(q, {}, ctx.signal))));
  for (const r of round1) if (r.status === "rejected") ctx.log("04 copies: запрос упал", String(r.reason));
  const hits = round1.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  laps.push(`раунд1 ${lap()}`);

  // Раунд 2: самое раннее упоминание — всё, что раньше самой старой найденной копии
  const oldest = minDate(hits.map((h) => h.candidate.publishedAt ?? dateFromUrl(h.candidate.url)));
  if (oldest) {
    const before = new Date(new Date(oldest).getTime() - 86_400_000).toISOString().slice(0, 10);
    const earliest = await limited(() =>
      tavilyCopies(queries[0]!, { end_date: before }, ctx.signal).then((r) =>
        r.map((h) => ({ ...h, earliest: true })),
      ),
    ).catch((err: unknown) => {
      ctx.log("04 copies: поиск раннего упоминания упал", String(err));
      return [] as CopyHit[];
    });
    hits.push(...earliest);
  }
  laps.push(`ранний ${lap()}`);

  // Одна страница могла найтись несколькими запросами — склеиваем, ссылки и «раннесть» сохраняем
  const linksByUrl = new Map<string, CopyHit>();
  for (const h of hits) {
    const prev = linksByUrl.get(h.candidate.url);
    linksByUrl.set(h.candidate.url, prev ? { ...prev, earliest: prev.earliest || h.earliest } : h);
  }
  const candidates = dedupe(hits.map((h) => h.candidate));

  // По теме ли страница — та же проверка, что для sources (доля ключевых слов тезиса)
  const stems = keywordStems(claim.normalized, claim.quote, ...claim.entities);
  const relevant = candidates
    .map((c) => enrich(c, stems))
    .filter((e): e is Enriched => e !== null)
    .filter((e) => isPublication(e, stems, linksByUrl.get(e.candidate.url)?.earliest ?? false))
    // раннее упоминание должно говорить о том же: если в утверждении есть числа — те же числа
    // («8 млрд» в 2022, а не «7 млрд» в 2011 или «+1 млрд к 2030» — это другие утверждения)
    .filter(
      (e) => !linksByUrl.get(e.candidate.url)?.earliest || mentionsClaimNumbers(e, claimNumbers(claim)),
    );

  const retrievedAt = new Date().toISOString();
  const copies = relevant
    .sort((a, b) => b.base - a.base)
    .slice(0, MAX_COPIES)
    .map((e) => toCopy(e, linksByUrl.get(e.candidate.url), retrievedAt));

  laps.push(`отбор ${lap()}`);
  await fillDatesFromPages(copies, ctx);
  laps.push(`даты-со-страниц ${lap()}`);

  // временные id — чтобы LLM могла сослаться на копию; окончательные — после сортировки по дате
  copies.forEach((c, i) => (c.id = `k${i + 1}`));
  // другое событие того же типа (старое землетрясение, прошлогодняя сделка) — не копия этого утверждения
  const kept = await filterSameEvent(claim, copies, ctx);
  laps.push(`то-же-событие ${lap()}`);
  ctx.log(`⏱ 04 copies ${claim.id}: ${laps.join(", ")}`);

  kept.sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999"));
  kept.forEach((c, i) => (c.id = `${claim.id}_c${i + 1}`));
  ctx.log(
    `04 copies: ${claim.id}: найдено ${candidates.length}, по теме ${kept.length}, ` +
      `с датой ${kept.filter((c) => c.publishedAt).length}, самая ранняя ${kept[0]?.publishedAt ?? "—"}`,
  );
  return kept;
}

// ---------- Tavily в режиме копий ----------

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
  published_date?: string;
}

async function tavilyCopies(
  q: PlannedQuery,
  dates: { end_date?: string },
  signal: AbortSignal,
  /** Задан — ссылки берём только из абзацев про утверждение */
  claimStems?: string[],
): Promise<CopyHit[]> {
  const res = await tavilyPost(
    {
      query: q.text,
      // basic — 1 кредит вместо 2: копий много, а качество выдержки тут проверяем сами
      search_depth: "basic",
      topic: "general",
      include_published_date: true,
      // markdown, а не text: в нём сохраняются ссылки — по ним видно, кто у кого взял
      include_raw_content: "markdown",
      // цена запроса от числа результатов не зависит
      max_results: 20,
      // страна из утверждения: поднимаем местные сайты для ro/ru, остальные остаются в выдаче
      ...(q.country && (q.language === "ro" || q.language === "ru") ? { country: q.country } : {}),
      ...dates,
      // профили и страницы людей совпадают по именам, а публикациями не являются
      exclude_domains: claimStems ? [...EXCLUDE_DOMAINS, "linkedin.com"] : EXCLUDE_DOMAINS,
    },
    signal,
  );

  const body = (await res.json()) as { results?: TavilyResult[] };
  return (body.results ?? []).map((r) => {
    const markdown = (r.raw_content || r.content).slice(0, 200_000);
    return {
      candidate: {
        url: r.url,
        title: r.title,
        text: stripMarkdown(markdown),
        publishedAt: r.published_date,
        relevance: r.score,
        language: q.language,
        queries: [{ text: q.text, intent: q.intent }],
        fallbackType: "news",
      },
      links: extractLinks(claimStems ? claimPassages(markdown, claimStems) : markdown, r.url),
      earliest: false,
    };
  });
}

/**
 * Это публикация об утверждении, а не случайная страница?
 *  - не главная и не рубрика (там лента свежих заголовков — совпадёт с чем угодно);
 *  - тема видна уже в заголовке. Для раунда «раннее упоминание» строже: туда легко попадают старые
 *    страницы, у которых в тексте сбоку висит лента сегодняшних новостей — их дата дала бы ложный «старый контент».
 */
function isPublication(e: Enriched, claimStems: string[], earliest: boolean): boolean {
  if (isFrontPage(e.candidate.url)) return false;
  const title = stemSet(e.candidate.title);
  const best = Math.max(
    hits(title, claimStems),
    ...e.candidate.queries.map((q) => hits(title, keywordStems(q.text))),
  );
  return best >= (earliest ? 2 : 1);
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
/** Что считает «число»: дата голосования, день, год — это время */
const DATE_LIKE =
  /дат[аыеу]|\bдень\b|\bдня\b|\bгод|месяц|\bdate\b|\bday\b|\byear|\bmonth|\bziu|\bzi\b|\bdata\b|\banul\b/iu;

/** Числа утверждения (без годов — год это время, а не величина): «8 миллиардов» → ["8"], «3,5 млн» → ["3.5"] */
export function claimNumbers(claim: Claim): string[] {
  const sources = claim.structure?.numbers.length
    ? claim.structure.numbers.filter((n) => !DATE_LIKE.test(n.about)).map((n) => n.value)
    : [claim.normalized];
  const found = sources.flatMap((text) => text.match(NUMBER) ?? []);
  // «14 октября» — время, а не величина: источник напишет дату иначе, и число «не найдётся»
  const timeDigits = new Set(claim.structure?.time?.text.match(NUMBER) ?? []);
  return [
    ...new Set(
      found
        .filter((n) => !timeDigits.has(n))
        .map((n) => n.replace(",", "."))
        .filter((n) => !/^(19|20)\d{2}$/.test(n)),
    ),
  ];
}

function mentionsClaimNumbers(e: Enriched, numbers: string[]): boolean {
  if (!numbers.length) return true;
  const text = `${e.candidate.title} ${e.excerpt}`.replace(/(\d),(\d)/g, "$1.$2");
  return numbers.some((n) => new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(text));
}

/** Страница поиска, тега или архива: это лента чужих заголовков с датой, а не публикация */
const LISTING_PATH =
  /\/(search|cautare|poisk|tag|tags|category|categorie|rubric|rubrica|archive|arhiva|page)(\/|$)/i;

export function isListingPage(url: string): boolean {
  try {
    const { pathname, search } = new URL(url);
    return LISTING_PATH.test(pathname) || /[?&](q|s|query|search)=/i.test(search);
  } catch {
    return true;
  }
}

/** "/", "/ru/", "/sections/news/" — главная или рубрика; у статьи обычно длинный адрес или число */
function isFrontPage(url: string): boolean {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.length <= 2 && segments.every((seg) => seg.length < 15 && !/\d/.test(seg));
  } catch {
    return true;
  }
}

// ---------- поиск по следам ----------

/** Разборы называют настоящее событие и его участников: это лучшие страницы для зацепок. По одному на язык */
export function debunkQueries(planned: PlannedQuery[]): PlannedQuery[] {
  const seen = new Set<LanguageCode>();
  return planned.filter((q) => q.intent === "refute" && !seen.has(q.language) && seen.add(q.language));
}

/** Запросы первого круга: сначала по одному на язык, чтобы ни один язык не выпал из поиска */
export function queriesByLanguage(planned: PlannedQuery[], max: number): PlannedQuery[] {
  const events = planned.filter((q) => q.intent !== "refute");
  const seen = new Set<LanguageCode>();
  const first = events.filter((q) => !seen.has(q.language) && seen.add(q.language));
  return [...first, ...events.filter((q) => !first.includes(q))].slice(0, max);
}

/**
 * Другие виды запросов к тому же утверждению: дословная цитата и связка «имена + числа».
 * В PAN объединение разных стратегий дало намного большую полноту, чем лучшая из них.
 */
export function extraQueries(claim: Claim, planned: PlannedQuery[]): PlannedQuery[] {
  const base = { language: claim.language, intent: "confirm", freshness: "any" } as const;
  const anchors = [...claim.entities.slice(0, 3), ...claimNumbers(claim).slice(0, 2)].join(" ");
  const texts = [exactQuery(claim.quote), claim.entities.length >= 2 ? anchors : null];
  const known = new Set(planned.map((q) => q.text.toLowerCase()));
  return texts
    .filter((text): text is string => !!text && !known.has(text.toLowerCase()))
    .map((text) => ({ ...base, text }));
}

/** Ранние и найденные по следу копии не должны выпасть из отбора из-за низкой релевантности */
const PROTECTED_COPIES = 12;
/**
 * Ранняя или найденная по следу копия: заметная доля ключевых слов. Поиск раньше известной даты всегда что-то
 * вернёт, и старая страница про «Молдову и министра» иначе станет ложным корнем. Замер: search-compare.ts
 */
const MIN_EARLY_MATCH = 0.6;
/** Следы открываем только от копий по теме, иначе шум порождает новый шум */
const MIN_TRACE_SOURCE_MATCH = 0.5;

export function protectEarly<T extends { base: number; early: boolean }>(items: T[], max: number): T[] {
  const early = items
    .filter((e) => e.early)
    .sort((a, b) => b.base - a.base)
    .slice(0, PROTECTED_COPIES);
  const rest = items.filter((e) => !early.includes(e)).sort((a, b) => b.base - a.base);
  return [...early, ...rest].slice(0, max);
}

/** Первый заголовок страницы или её первая строка */
function pageTitle(markdown: string, url: string): string {
  const line = markdown.split("\n").find((l) => l.trim().length > 10);
  return (line ?? url)
    .replace(/^#+\s*/, "")
    .trim()
    .slice(0, 200);
}

/** Tavily Extract: текст страниц по адресам. Одна пачка до MAX_LINKS_PER_ROUND адресов */
async function tavilyExtract(urls: string[], stems: string[], signal: AbortSignal): Promise<CopyHit[]> {
  if (!urls.length) return [];
  await throttle();
  searchCredits.count += Math.ceil(urls.length / 5);
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.providers.search.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ urls, format: "markdown", extract_depth: "basic" }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT_MS * 3)]),
  });
  if (!res.ok) throw new Error(`Tavily extract ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { results?: Array<{ url: string; raw_content?: string | null }> };
  return (body.results ?? []).flatMap((r) => {
    const markdown = (r.raw_content ?? "").slice(0, 200_000);
    if (!markdown) return [];
    return [
      {
        candidate: {
          url: r.url,
          title: pageTitle(markdown, r.url),
          text: stripMarkdown(markdown),
          relevance: 0.5,
          language: "und",
          queries: [],
          fallbackType: "news" as const,
        },
        links: extractLinks(claimPassages(markdown, stems), r.url),
        earliest: false,
        traced: true,
      },
    ];
  });
}

/**
 * Поиск по следам: первый круг по одному запросу на язык, потом до MAX_TRACE_ROUNDS кругов добора.
 * Останавливаемся, когда открытых следов нет, а не когда «всё выяснили»: см. traces.ts.
 */
/** Сколько слов утверждения должно быть на странице, где зацепка встретилась только в тексте */
const MIN_ANCHOR_TOPIC_HITS = 3;

/** Страницы для выписывания зацепок: сначала самые близкие к утверждению, разборы и источники вперемешку */
function anchorPages(copies: SourceCopy[], matches: Map<string, number>, sources: Enriched[]): AnchorPage[] {
  const fromCopies = copies.map((c) => ({
    id: c.url,
    title: c.title,
    excerpt: c.excerpt,
    text: c.fullText ?? c.excerpt,
    language: c.language,
    match: matches.get(c.url) ?? 0,
  }));
  const known = new Set(copies.map((c) => c.url));
  const fromSources = sources
    .filter((e) => !known.has(e.candidate.url))
    .map((e) => ({
      id: e.candidate.url,
      title: e.candidate.title,
      excerpt: e.excerpt,
      text: e.candidate.text,
      language: e.language,
      match: e.match,
    }));
  return [...fromCopies, ...fromSources]
    .sort((a, b) => b.match - a.match)
    .map((page, i): AnchorPage => ({ ...page, id: `p${i + 1}` }));
}

/** По зацепке спрашиваем поисковик и сами сайты. Страница без зацепки — случайная выдача */
async function searchAnchor(
  anchor: Anchor,
  claim: Claim,
  main: PlannedQuery,
  stems: string[],
  ctx: StageContext,
): Promise<CopyHit[]> {
  const place = claim.entities.find((e) => !mentionsAnchor(anchor.term, e)) ?? "";
  const query: PlannedQuery = {
    ...main,
    text: `${anchor.term} ${place}`.trim(),
    language: anchor.language,
    intent: "context",
  };
  const [engine, sites] = await Promise.all([
    limited(() => tavilyCopies(query, {}, ctx.signal, stems)).catch((err: unknown) => {
      ctx.log("04 anchors: запрос упал", String(err));
      return [] as CopyHit[];
    }),
    searchSites(anchor, main.country, ctx),
  ]);
  const direct = sites.map((candidate): CopyHit => ({ candidate, links: [], earliest: false }));
  return [...engine, ...direct]
    .filter(({ candidate: { title, text } }) => {
      if (mentionsAnchor(title, anchor.term)) return true;
      // название в тексте случайной новости ещё ни о чём не говорит: нужна и тема утверждения
      return (
        mentionsAnchor(text, anchor.term) &&
        hits(stemSet(`${title}\n${text}`), stems) >= MIN_ANCHOR_TOPIC_HITS
      );
    })
    .map((h) => ({ ...h, traced: true }));
}

async function traceCopies(
  claim: Claim,
  planned: PlannedQuery[],
  ctx: StageContext,
  sourcePages: Promise<Enriched[]>,
  extraSearch?: (q: PlannedQuery) => Promise<Candidate[]>,
): Promise<CopiesResult> {
  const queries = queriesByLanguage(planned, MAX_COPY_QUERIES + 1);
  const firstRound = [...queries, ...debunkQueries(planned), ...extraQueries(claim, queries)];
  ctx.log(
    `04 traces: ${claim.id}: страна ${queries[0]?.country ?? "не задана"}, запросы`,
    firstRound.map((q) => `${q.language}/${q.intent}: ${q.text}`),
  );
  if (!queries.length) return { copies: [], traces: { rounds: 0, stopped: "exhausted", traces: [] } };
  const stems = keywordStems(claim.normalized, claim.quote, ...claim.entities);
  const languages = [...new Set(queries.map((q) => q.language))];
  const hitsFound: CopyHit[] = [];
  const log: Trace[] = [];
  const triedLinks = new Set<string>();
  const triedCitations = new Set<string>();
  const triedPhrases = new Set<string>();
  const triedAnchors = new Set<string>();
  const searchedBefore = new Map<LanguageCode, string>();

  const extra = extraSearch
    ? queries.map((q) =>
        extraSearch(q).then((found) =>
          found.map((candidate): CopyHit => ({ candidate, links: [], earliest: false })),
        ),
      )
    : [];
  const first = await Promise.allSettled([
    ...firstRound.map((q) => limited(() => tavilyCopies(q, {}, ctx.signal, stems))),
    ...extra,
  ]);
  for (const r of first) {
    if (r.status === "fulfilled") hitsFound.push(...r.value);
    else ctx.log("04 traces: запрос упал", String(r.reason));
  }

  let { copies, matches } = await assembleCopies(hitsFound, stems, ctx);
  let rounds = 0;
  let stopped: TraceReport["stopped"] = "exhausted";

  for (;;) {
    const focused = copies.filter((c) => (matches.get(c.url) ?? 0) >= MIN_TRACE_SOURCE_MATCH);
    const links = openLinks(focused, triedLinks).filter((l) => !copies.some((c) => c.url === l));
    const citations = openCitations(focused, triedCitations);
    const oldest = oldestDate(focused);
    const older = openLanguages(languages, oldest, searchedBefore);
    const phrases = quotedPhrases(focused, triedPhrases);
    const sources = await sourcePages;
    const anchors =
      rounds < MAX_TRACE_ROUNDS
        ? await pickAnchors(claim, anchorPages(focused, matches, sources), triedAnchors, ctx)
        : [];
    if (!links.length && !citations.length && !older.length && !phrases.length && !anchors.length) break;
    if (rounds === MAX_TRACE_ROUNDS) {
      stopped = "budget";
      log.push(
        ...outOfBudget("link", links),
        ...outOfBudget("citation", citations),
        ...outOfBudget("older", older),
        ...outOfBudget("phrase", phrases),
      );
      break;
    }
    rounds++;

    const pickedLinks = links.slice(0, MAX_LINKS_PER_ROUND);
    const pickedCitations = citations.slice(0, MAX_CITATIONS_PER_ROUND);
    for (const url of pickedLinks) triedLinks.add(canonicalLink(url));
    for (const name of pickedCitations) triedCitations.add(name.toLowerCase());
    const pickedPhrases = phrases.slice(0, MAX_PHRASES_PER_ROUND);
    for (const phrase of pickedPhrases) triedPhrases.add(phrase.toLowerCase());
    for (const anchor of anchors) triedAnchors.add(normalizeTerm(anchor.term));
    if (anchors.length)
      ctx.log(
        `04 anchors: ${claim.id}: зацепки`,
        anchors.map((a) => a.term),
      );
    if (oldest) for (const language of older) searchedBefore.set(language, oldest);

    const before = oldest
      ? new Date(new Date(oldest).getTime() - 86_400_000).toISOString().slice(0, 10)
      : undefined;
    const main = queries[0]!;
    const [fromLinks, fromCitations, fromOlder, fromPhrases, fromAnchors] = await Promise.all([
      limited(() => tavilyExtract(pickedLinks, stems, ctx.signal)).catch((err: unknown) => {
        ctx.log("04 traces: ссылки не открылись", String(err));
        return [] as CopyHit[];
      }),
      Promise.all(
        pickedCitations.map((name) =>
          limited(() =>
            tavilyCopies(
              { ...main, text: `${citedName(name)} ${withoutNumbers(main.text)}`.slice(0, 200) },
              {},
              ctx.signal,
              stems,
            ),
          )
            .then((found) => ({ name, found: found.map((h) => ({ ...h, traced: true })) }))
            .catch(() => ({ name, found: [] as CopyHit[] })),
        ),
      ),
      Promise.all(
        older.map((language) => {
          const q = queries.find((x) => x.language === language) ?? main;
          return limited(() =>
            tavilyCopies({ ...q, text: withoutNumbers(q.text) }, { end_date: before }, ctx.signal, stems),
          )
            .then((found) => ({ language, found: found.map((h) => ({ ...h, earliest: true })) }))
            .catch(() => ({ language, found: [] as CopyHit[] }));
        }),
      ),
      Promise.all(
        pickedPhrases.map((phrase) =>
          limited(() => tavilyCopies({ ...main, text: `"${phrase}"` }, {}, ctx.signal, stems))
            .then((found) => ({ phrase, found: found.map((h) => ({ ...h, traced: true })) }))
            .catch(() => ({ phrase, found: [] as CopyHit[] })),
        ),
      ),
      Promise.all(
        anchors.map((anchor) =>
          searchAnchor(anchor, claim, main, stems, ctx).then((found) => ({ anchor, found })),
        ),
      ),
    ]);

    const opened = new Set(fromLinks.map((h) => canonicalLink(h.candidate.url)));
    for (const url of pickedLinks) {
      log.push({
        kind: "link",
        target: url,
        status: opened.has(canonicalLink(url)) ? "found" : "not_found",
      });
    }
    for (const { name, found } of fromCitations) {
      log.push({ kind: "citation", target: name, status: found.length ? "found" : "not_found" });
    }
    for (const { phrase, found } of fromPhrases) {
      log.push({ kind: "phrase", target: phrase, status: found.length ? "found" : "not_found" });
    }
    for (const { language, found } of fromOlder) {
      log.push({ kind: "older", target: language, status: found.length ? "found" : "not_found" });
    }
    for (const { anchor, found } of fromAnchors) {
      log.push({ kind: "anchor", target: anchor.term, status: found.length ? "found" : "not_found" });
    }
    hitsFound.push(
      ...fromLinks,
      ...fromCitations.flatMap((c) => c.found),
      ...fromOlder.flatMap((o) => o.found),
      ...fromPhrases.flatMap((p) => p.found),
      ...fromAnchors.flatMap((a) => a.found),
    );
    ({ copies, matches } = await assembleCopies(hitsFound, stems, ctx));
  }

  copies.forEach((c, i) => (c.id = `k${i + 1}`));
  const story = await filterSameEvent(claim, copies, ctx, true);
  // порядок копий — по весу, поэтому лимит режет самые слабые из тех, что прошли фильтр
  const kept = story.slice(0, MAX_COPIES);
  if (kept.length < story.length)
    ctx.log(`04 traces: ${claim.id}: лимит отрезал ${story.length - kept.length}`);
  kept.sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999"));
  kept.forEach((c, i) => (c.id = `${claim.id}_c${i + 1}`));
  const found = log.filter((t) => t.status === "found").length;
  ctx.log(
    `04 traces: ${claim.id}: кругов ${rounds}, остановка ${stopped}, следов ${log.length}, ` +
      `дали результат ${found}, до фильтра ${copies.length}, копий ${kept.length}, ` +
      `самая ранняя ${kept[0]?.publishedAt ?? "—"}`,
  );
  return { copies: kept, traces: { rounds, stopped, traces: log } };
}

function canonicalLink(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[#?].*$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/** Найденное → копии с датами. Числа не проверяем: другое число у раннего источника и есть мутация */
async function assembleCopies(
  found: CopyHit[],
  stems: string[],
  ctx: StageContext,
): Promise<{ copies: SourceCopy[]; matches: Map<string, number> }> {
  const byUrl = new Map<string, CopyHit>();
  for (const h of found) {
    const prev = byUrl.get(h.candidate.url);
    byUrl.set(
      h.candidate.url,
      prev
        ? {
            ...prev,
            earliest: prev.earliest || h.earliest,
            traced: prev.traced || h.traced,
            links: [...new Set([...prev.links, ...h.links])],
          }
        : h,
    );
  }
  const relevant = dedupe(found.map((h) => h.candidate))
    .map((c) => enrich(c, stems))
    .filter((e): e is Enriched => e !== null)
    .filter((e) => !isListingPage(e.candidate.url))
    .filter((e) => {
      const hit = byUrl.get(e.candidate.url);
      if (hit?.earliest || hit?.traced) {
        if (e.match < MIN_EARLY_MATCH) return false;
        // на страницу сослалась другая копия: заголовок может быть любым
        return hit.traced || isPublication(e, stems, true);
      }
      return isPublication(e, stems, false);
    })
    .map((e) => {
      const hit = byUrl.get(e.candidate.url);
      return { e, base: e.base, early: !!(hit?.earliest || hit?.traced) };
    });

  const retrievedAt = new Date().toISOString();
  const picked = protectEarly(relevant, MAX_POOL).map(({ e }) => {
    const hit = byUrl.get(e.candidate.url);
    const copy: SourceCopy = {
      ...toCopy(e, hit, retrievedAt),
      ...(hit?.traced ? { traced: true } : {}),
      fullText: e.candidate.text.slice(0, MAX_FULL_TEXT),
      voter: { snippet: e.snippet, domainReliability: e.info.reliability, country: e.info.country },
    };
    return { copy, pageStems: [...stems, ...keywordStems(...e.candidate.queries.map((q) => q.text))] };
  });
  await forEachPage(picked, ({ copy, pageStems }) => readPage(copy, pageStems, ctx));
  const copies = picked.map((p) => p.copy);
  return { copies, matches: new Map(relevant.map(({ e }) => [e.candidate.url, e.match])) };
}

/** Сколько текста страницы храним для сравнения копий между собой */
const MAX_FULL_TEXT = 30_000;

/** Дополняет копию тем, что есть только на самой странице: датой из разметки, ссылками и атрибуциями в тексте */
async function readPage(copy: SourceCopy, stems: string[], ctx: StageContext): Promise<void> {
  const html = await openPage(copy.url, ctx);
  if (!html) return;
  if (!isLivingDocument(copy.url)) {
    // дата поисковика бывает датой обхода: разметке страницы верим больше
    const published = dateFromHtml(html, false) ?? (copy.publishedAt ? undefined : dateFromHtml(html));
    if (published) Object.assign(copy, { publishedAt: published, dateSource: "page" });
  }
  const markdown = htmlToMarkdown(html);
  const passages = claimPassages(markdown, stems);
  copy.outboundLinks = [...new Set([...copy.outboundLinks, ...extractLinks(passages, copy.url)])].slice(
    0,
    MAX_LINKS,
  );
  copy.attributions = [
    ...new Set([...copy.attributions, ...extractAttributions(stripMarkdown(passages))]),
  ].slice(0, MAX_ATTRIBUTIONS);
  const text = stripMarkdown(markdown);
  if (text.length > (copy.fullText?.length ?? 0) / 2) copy.fullText = text.slice(0, MAX_FULL_TEXT);
}

function toCopy(e: Enriched, hit: CopyHit | undefined, retrievedAt: string): SourceCopy {
  // у Википедии и счётчиков поисковик отдаёт дату последней правки — это не дата публикации
  const living = isLivingDocument(e.candidate.url);
  // дата в адресе надёжнее поисковика: это дата самой публикации, а не обхода
  const fromUrl = living ? undefined : dateFromUrl(e.candidate.url);
  const fromSearch = living || fromUrl ? undefined : toIso(e.candidate.publishedAt);
  return {
    id: "",
    url: e.candidate.url,
    title: cleanText(e.candidate.title) || e.info.publisher,
    publisher: e.info.publisher,
    domain: e.domain,
    sourceType: e.info.type,
    language: e.language,
    publishedAt: fromSearch ?? fromUrl,
    dateSource: fromSearch ? "search" : fromUrl ? "url" : undefined,
    excerpt: e.excerpt,
    outboundLinks: hit?.links ?? [],
    // только из куска про утверждение: на странице рядом лента чужих новостей со своими «сообщил…»
    attributions: extractAttributions(e.excerpt),
    earliestSearch: hit?.earliest ?? false,
    retrievedAt,
  };
}

// ---------- даты ----------

/** Даты без даты в поиске и в адресе — ищем в разметке страницы (JSON-LD, meta-теги) */
async function fillDatesFromPages(copies: SourceCopy[], ctx: StageContext): Promise<void> {
  const undated = copies
    .filter((c) => !c.publishedAt && !isLivingDocument(c.url))
    .slice(0, MAX_PAGE_DATE_FETCHES);
  await Promise.all(
    undated.map(async (c) => {
      try {
        const res = await fetch(c.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; FactCheckBot/1.0)", accept: "text/html" },
          signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
        });
        if (!res.ok) return;
        // дата почти всегда в <head> — дальше не читаем
        const date = dateFromHtml((await res.text()).slice(0, 300_000));
        if (date) Object.assign(c, { publishedAt: date, dateSource: "page" });
      } catch {
        // страница не открылась — остаёмся без даты, это не ошибка этапа
      }
    }),
  );
}

/**
 * «Живые документы» — Википедия, викисклад, счётчики: страница правится годами, у неё нет даты публикации факта.
 * Дата создания статьи («Население Земли», 2011) дала бы ложный «старый контент» верному утверждению о 2022 годе.
 */
const LIVING_DOC_HOST = /wiki|(^|\.)(fandom\.com|worldometers\.info|britannica\.com|dic\.academic\.ru)$/i;
/** Опубликовано и изменено различаются больше чем на год — постоянно правящаяся страница, её дате не верим */
const LIVING_DOC_GAP_MS = 365 * 86_400_000;

export function isLivingDocument(url: string): boolean {
  try {
    return LIVING_DOC_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** JSON-LD datePublished → meta article:published_time и аналоги → <time datetime> → dateModified */
export function dateFromHtml(html: string, allowModified = true): ISODateString | undefined {
  const published = toIso(html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1]);
  const modified = toIso(html.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1]);
  if (published && modified && Date.parse(modified) - Date.parse(published) > LIVING_DOC_GAP_MS) {
    return undefined;
  }
  if (published) return published;

  const patterns = [
    /<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|pubdate|publishdate|publish-date|date|DC\.date\.issued)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|datePublished|pubdate)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const iso = toIso(html.match(re)?.[1]);
    if (iso) return iso;
  }
  // запасной вариант: даты публикации нет, есть только «изменено» (например, point.md)
  return allowModified ? modified : undefined;
}

/** /2023/03/14/, /2023-03-14-, /20230314/ в адресе — многие сайты кладут дату публикации в URL */
export function dateFromUrl(url: string): ISODateString | undefined {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();
  const m =
    path.match(/(?:^|\/)((?:19|20)\d{2})[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])(?:\/|-|$)/) ??
    path.match(/(?:^|\/)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:\/|-|_|$)/) ??
    // Reuters: /world/some-title-2026-06-08/
    path.match(/-((?:19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\/?$/);
  return m ? toIso(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : undefined;
}

function toIso(raw: string | null | undefined): ISODateString | undefined {
  if (!raw) return undefined;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1995 || d.getTime() > Date.now() + 86_400_000) {
    return undefined;
  }
  return d.toISOString();
}

function minDate(dates: Array<string | undefined>): ISODateString | undefined {
  const valid = dates.map(toIso).filter((d): d is string => !!d);
  return valid.length ? valid.sort()[0] : undefined;
}

// ---------- ссылки и «по данным …» ----------

/** Кнопки «поделиться», медиафайлы, служебные страницы — это не первоисточники */
const JUNK_LINK =
  /\/(share|sharer|intent|login|signup|subscribe|tag|tags|hashtag|category|author|search|user|channel)(\/|\?|$)|\.(jpe?g|png|gif|webp|svg|pdf|mp3|m4a|mp4|wav|ogg|webm|mov|zip)(\?|$)/i;
/** Счётчики, агрегаторы, магазины приложений, хостинги подкастов */
const JUNK_HOST =
  /(^|\.)(google\.com|top\.mail\.ru|fbcdn\.net|commons\.wikimedia\.org|yandex\.ru|google-analytics\.com|googletagmanager\.com|doubleclick\.net|news\.google\.com|play\.google\.com|apps\.apple\.com|podtrac\.com|byspotify\.com|simplecastaudio\.com|bit\.ly)$/i;

/** Внешние ссылки из markdown (на другие сайты): [текст](url) и голые https://… */
export function extractLinks(markdown: string, pageUrl: string): string[] {
  let site = "";
  try {
    site = registrableDomain(normalizeHost(new URL(pageUrl).hostname));
  } catch {
    // кривой адрес страницы — тогда просто не отсеиваем свои ссылки
  }
  const found = [
    ...markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g),
    ...markdown.matchAll(/(?<![([])\bhttps?:\/\/[^\s)\]>"']+/g),
  ].map((m) => (m[1] ?? m[0]).replace(/[.,;:]+$/, ""));

  const links = new Set<string>();
  for (const raw of found) {
    try {
      const url = new URL(raw);
      const host = normalizeHost(url.hostname);
      if (
        registrableDomain(host) === site ||
        JUNK_HOST.test(host) ||
        JUNK_LINK.test(url.pathname + url.search)
      )
        continue;
      // главная страница или профиль (иконка соцсети в подвале, max.ru/vedomosti) — не источник;
      // конкретный материал: несколько уровней пути (t.me/канал/123, nytimes.com/2026/…) или длинный адрес
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length < 2 && (segments[0]?.length ?? 0) < 20) continue;
      url.hash = "";
      links.add(url.toString());
    } catch {
      // не URL — пропускаем
    }
    if (links.size >= MAX_LINKS) break;
  }
  return [...links];
}

/**
 * «по данным мэрии», «сообщает NewsMaker», «potrivit poliției», «according to Reuters» —
 * признак, что текст пересказывает кого-то. Берём фразу-маркер и 1–5 слов после неё.
 */
const ATTRIBUTION =
  /(?<!\p{L})(по данным|по информации|по словам|со ссылкой на|как сообщает|как сообщил[аио]?|сообщает|сообщил[аио]?|заявил[аио]?|potrivit|conform|citat de|a declarat|a anunțat|according to|reported by|citing|said)\s+(?!(?:о|об|что|в|на|that|că|ca|despre|on|in)\s)((?:[\p{Lu}«"„][\p{L}\p{N}»"”-]*|[\p{L}\p{N}-]+)(?:\s+[\p{L}\p{N}«»"„”-]+){0,4})/giu;

export function extractAttributions(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(ATTRIBUTION)) {
    const phrase = `${m[1]} ${m[2]}`
      .replace(/\s+/g, " ")
      .replace(/[,.;:!?]+$/, "")
      .trim();
    if (phrase.length >= 8) out.add(phrase);
    if (out.size >= MAX_ATTRIBUTIONS) break;
  }
  return [...out];
}

/** markdown → текст для поиска ключевых слов и выдержки: ссылки → их текст, разметку убираем */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>|]+/g, " ")
    .replace(/[ \t]+/g, " ");
}
