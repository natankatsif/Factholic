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
 */
import type { ISODateString } from "@news/contracts";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import type { Claim } from "../03-claim-extraction/types.ts";
import { normalizeHost } from "./domains.ts";
import { limited, type Candidate } from "./engines.ts";
import type { PlannedQuery } from "./queries.ts";
import { dedupe, enrich, registrableDomain, type Enriched } from "./select.ts";
import { cleanText, hits, keywordStems, stemSet } from "./text.ts";
import type { SourceCopy } from "./types.ts";

const MAX_COPY_QUERIES = 3;
const MAX_COPIES = 25;
/** Сколько страниц без даты докачиваем, чтобы найти дату в разметке (каждая — отдельный запрос) */
const MAX_PAGE_DATE_FETCHES = 8;
const TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 8_000;
const MAX_LINKS = 20;
const MAX_ATTRIBUTIONS = 8;

/** Соцсети и видеохостинги — не публикации, а такой же пользовательский контент (как в engines.ts) */
const EXCLUDE_DOMAINS = ["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "pinterest.com"];

interface CopyHit {
  candidate: Candidate;
  links: string[];
  earliest: boolean;
}

export async function findCopies(
  claim: Claim,
  planned: PlannedQuery[],
  ctx: StageContext,
): Promise<SourceCopy[]> {
  // запросы-описания события; «опровержения» не нужны — нужны сами перепечатки
  const queries = planned.filter((q) => q.intent !== "refute").slice(0, MAX_COPY_QUERIES);
  if (!queries.length) return [];

  // Раунд 1
  const round1 = await Promise.allSettled(queries.map((q) => limited(() => tavilyCopies(q, {}, ctx.signal))));
  for (const r of round1) if (r.status === "rejected") ctx.log("04 copies: запрос упал", String(r.reason));
  const hits = round1.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

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
    .filter((e) => isPublication(e, stems, linksByUrl.get(e.candidate.url)?.earliest ?? false));

  const retrievedAt = new Date().toISOString();
  const copies = relevant
    .sort((a, b) => b.base - a.base)
    .slice(0, MAX_COPIES)
    .map((e) => toCopy(e, linksByUrl.get(e.candidate.url), retrievedAt));

  await fillDatesFromPages(copies, ctx);

  copies.sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999"));
  copies.forEach((c, i) => (c.id = `${claim.id}_c${i + 1}`));
  ctx.log(
    `04 copies: ${claim.id}: найдено ${candidates.length}, по теме ${copies.length}, ` +
      `с датой ${copies.filter((c) => c.publishedAt).length}, самая ранняя ${copies[0]?.publishedAt ?? "—"}`,
  );
  return copies;
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
): Promise<CopyHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.providers.search.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: q.text,
      // basic — 1 кредит вместо 2: копий много, а качество выдержки тут проверяем сами
      search_depth: "basic",
      topic: "general",
      include_published_date: true,
      // markdown, а не text: в нём сохраняются ссылки — по ним видно, кто у кого взял
      include_raw_content: "markdown",
      max_results: 10,
      // фокус проекта — молдавское инфопространство: поднимаем местные сайты для ro/ru
      ...(q.language === "ro" || q.language === "ru" ? { country: "moldova" } : {}),
      ...dates,
      exclude_domains: EXCLUDE_DOMAINS,
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`);

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
      links: extractLinks(markdown, r.url),
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

/** "/", "/ru/", "/sections/news/" — главная или рубрика; у статьи обычно длинный адрес или число */
function isFrontPage(url: string): boolean {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.length <= 2 && segments.every((seg) => seg.length < 15 && !/\d/.test(seg));
  } catch {
    return true;
  }
}

function toCopy(e: Enriched, hit: CopyHit | undefined, retrievedAt: string): SourceCopy {
  const fromSearch = toIso(e.candidate.publishedAt);
  const fromUrl = fromSearch ? undefined : dateFromUrl(e.candidate.url);
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
  const undated = copies.filter((c) => !c.publishedAt).slice(0, MAX_PAGE_DATE_FETCHES);
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

/** JSON-LD datePublished → meta article:published_time и аналоги → <time datetime> → dateModified */
export function dateFromHtml(html: string): ISODateString | undefined {
  const patterns = [
    /"datePublished"\s*:\s*"([^"]+)"/,
    /<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|pubdate|publishdate|publish-date|date|DC\.date\.issued)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|datePublished|pubdate)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    // запасной вариант: даты публикации нет, есть только «изменено» (например, point.md)
    /"dateModified"\s*:\s*"([^"]+)"/,
  ];
  for (const re of patterns) {
    const iso = toIso(html.match(re)?.[1]);
    if (iso) return iso;
  }
  return undefined;
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
    path.match(/(?:^|\/)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:\/|-|_|$)/);
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
  /\/(share|sharer|intent|login|signup|subscribe|tag|tags|category|author|search)(\/|\?|$)|\.(jpe?g|png|gif|webp|svg|pdf|mp3|m4a|mp4|wav|ogg|webm|mov|zip)(\?|$)/i;
/** Счётчики, агрегаторы, магазины приложений, хостинги подкастов */
const JUNK_HOST =
  /(^|\.)(google\.com|top\.mail\.ru|yandex\.ru|google-analytics\.com|googletagmanager\.com|doubleclick\.net|news\.google\.com|play\.google\.com|apps\.apple\.com|podtrac\.com|byspotify\.com|simplecastaudio\.com|bit\.ly)$/i;

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
