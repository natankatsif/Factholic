/**
 * Свой SearXNG: дополнительный источник для повторных заходов поиска (scripts/searxng.sh).
 * Способ неофициальный, поисковики его блокируют, поэтому сбой не роняет проверку: пустая выдача и запись в лог.
 * В выдаче только заголовок и отрывок, страницу читаем сами. Адрес не задан — источника нет.
 */
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import type { Candidate } from "./engines.ts";
import { forEachPage, htmlToMarkdown, openPage } from "./pages.ts";
import type { PlannedQuery } from "./queries.ts";
import { hits, keywordStems, stemSet } from "./text.ts";

const TIMEOUT_MS = 10_000;
/** Сколько страниц выдачи берём: на пятой по теме оставалось около 65% */
const RESULT_PAGES = 3;
const MAX_OPENED_PAGES = 24;
const MIN_HITS = 2;

interface Reply {
  results?: Array<{ title: string; url: string; content?: string; publishedDate?: string | null }>;
  unresponsive_engines?: Array<[string, string]>;
}

type Result = NonNullable<Reply["results"]>[number];

/** Близкие к запросу, из них ранние первыми, без повторов */
export function rankResults(results: Result[], query: string, max = MAX_OPENED_PAGES): Result[] {
  const stems = keywordStems(query);
  const need = Math.min(MIN_HITS, stems.length);
  const seen = new Set<string>();
  return results
    .filter((r) => {
      if (seen.has(r.url) || hits(stemSet(`${r.title} ${r.content ?? ""}`), stems) < need) return false;
      seen.add(r.url);
      return true;
    })
    .sort((a, b) => (a.publishedDate ?? "9999").localeCompare(b.publishedDate ?? "9999"))
    .slice(0, max);
}

async function page(q: PlannedQuery, number: number, ctx: StageContext): Promise<Reply> {
  const url = new URL("/search", config.providers.searxng.url);
  url.searchParams.set("q", q.text);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageno", String(number));
  const res = await fetch(url, { signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(TIMEOUT_MS)]) });
  if (!res.ok) throw new Error(`SearXNG ${res.status}`);
  return (await res.json()) as Reply;
}

export async function searchSearxng(q: PlannedQuery, ctx: StageContext): Promise<Candidate[]> {
  if (!config.providers.searxng.url) return [];
  const numbers = Array.from({ length: RESULT_PAGES }, (_, i) => i + 1);
  const replies = await Promise.allSettled(numbers.map((n) => page(q, n, ctx)));
  const ok = replies.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const refused = new Set(ok.flatMap((r) => (r.unresponsive_engines ?? []).map(([engine]) => engine)));
  const results = ok.flatMap((r) => r.results ?? []);
  // блокировка движка выглядит как меньшая выдача, поэтому её обязательно видно в логе
  ctx.log(
    `04 searxng: «${q.text}»: всего ${results.length}${refused.size ? `, отказали: ${[...refused].join(", ")}` : ""}`,
  );

  const found: Candidate[] = [];
  await forEachPage(rankResults(results, q.text), async (r) => {
    const html = await openPage(r.url, ctx);
    found.push({
      url: r.url,
      title: r.title,
      text: html ? htmlToMarkdown(html).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") : (r.content ?? r.title),
      ...(r.publishedDate ? { publishedAt: r.publishedDate } : {}),
      relevance: 0.6,
      language: q.language,
      queries: [{ text: q.text, intent: q.intent }],
      fallbackType: "news",
    });
  });
  return found;
}
