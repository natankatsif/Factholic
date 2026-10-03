/**
 * Шаг 2: поисковые движки. Каждый возвращает кандидатов в общем виде, дальше их отбирает select.ts.
 *   tavily        — основной поиск, сразу отдаёт текст страницы (не надо качать самим). TAVILY_API_KEY
 *   factcheck_api — Google Fact Check Tools: готовые разборы фактчекеров. GOOGLE_FACTCHECK_API_KEY (опционально)
 */
import type { LanguageCode, SourceType } from "@news/contracts";
import { config } from "../../config.ts";
import type { PlannedQuery, QueryIntent } from "./queries.ts";

export interface Candidate {
  url: string;
  title: string;
  /** Текст страницы (или его релевантные куски), из него вырезается excerpt */
  text: string;
  publishedAt?: string;
  /** 0..1 — оценка релевантности от поисковика */
  relevance: number;
  /** Язык запроса; язык страницы уточняется по тексту */
  language: LanguageCode;
  /**
   * Запросы, которые нашли страницу (после dedupe их может быть несколько).
   * Их слова тоже считаются ключевыми: запрос мог быть на другом языке, чем тезис.
   */
  queries: Array<{ text: string; intent: QueryIntent }>;
  /** Тип по умолчанию, если домена нет в справочнике */
  fallbackType: SourceType;
  /** Готовые excerpt/snippet/издатель — у Fact Check API они есть в ответе */
  preset?: { publisher?: string; excerpt: string; snippet: string };
}

const TIMEOUT_MS = 20_000;

/** Не берём видеохостинги и соцсети: это не источники, а такой же пользовательский контент */
const EXCLUDE_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "reddit.com",
  "vk.com",
  "ok.ru",
  "t.me",
  "pinterest.com",
  "quora.com",
];

// ---------- Tavily ----------

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
  published_date?: string;
}

/** Пауза перед повтором, если Tavily ответил 429 «слишком часто» */
const RETRY_AFTER_429_MS = 1500;

/**
 * POST /search с ключом и таймаутом. 429 (лимит запросов в минуту) — один повтор через паузу:
 * при параллельной проверке нескольких видео запросы идут пачками. Другие ошибки — исключение.
 */
export async function tavilyPost(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.providers.search.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    if (res.ok) return res;
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, RETRY_AFTER_429_MS));
      continue;
    }
    throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export async function tavilySearch(q: PlannedQuery, signal: AbortSignal): Promise<Candidate[]> {
  const res = await tavilyPost(
    {
      query: q.text,
      search_depth: "advanced",
      topic: q.freshness === "month" ? "news" : "general",
      ...(q.freshness !== "any" && { time_range: q.freshness }),
      max_results: 6,
      chunks_per_source: 3,
      include_raw_content: "text",
      exclude_domains: EXCLUDE_DOMAINS,
    },
    signal,
  );

  const body = (await res.json()) as { results?: TavilyResult[] };
  return (body.results ?? []).map((r) => ({
    url: r.url,
    title: r.title,
    // больше не разбираем: дальше обычно комментарии и подвал, а обработка синхронная
    text: (r.raw_content || r.content).slice(0, 200_000),
    publishedAt: r.published_date,
    relevance: r.score,
    language: q.language,
    queries: [{ text: q.text, intent: q.intent }],
    fallbackType: q.freshness === "month" ? "news" : "other",
  }));
}

// ---------- Google Fact Check Tools ----------

interface FactCheckClaim {
  text?: string;
  claimant?: string;
  claimReview?: Array<{
    publisher?: { name?: string; site?: string };
    url?: string;
    title?: string;
    reviewDate?: string;
    textualRating?: string;
    languageCode?: string;
  }>;
}

export async function factCheckSearch(q: PlannedQuery, signal: AbortSignal): Promise<Candidate[]> {
  const url = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
  url.searchParams.set("query", q.text);
  url.searchParams.set("languageCode", q.language);
  url.searchParams.set("pageSize", "5");
  const res = await fetch(url, {
    // ключ в заголовке, а не в URL — чтобы не светился в логах
    headers: { "x-goog-api-key": config.providers.factCheck.apiKey },
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (!res.ok) throw new Error(`Fact Check API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as { claims?: FactCheckClaim[] };
  return (body.claims ?? []).flatMap((claim, i) =>
    (claim.claimReview ?? [])
      .filter((r) => r.url)
      .map((r): Candidate => {
        const publisher = r.publisher?.name ?? r.publisher?.site;
        const reviewed = claim.text ? `«${claim.text}»${claim.claimant ? ` (${claim.claimant})` : ""}` : "";
        const verdict = r.textualRating ? `${publisher ?? "Фактчекер"}: ${r.textualRating}.` : "";
        const excerpt = [reviewed && `Проверяемое утверждение: ${reviewed}.`, verdict, r.title]
          .filter(Boolean)
          .join(" ");
        return {
          url: r.url!,
          title: r.title ?? claim.text ?? r.url!,
          text: excerpt,
          publishedAt: r.reviewDate,
          // порядок выдачи API — единственный сигнал релевантности
          relevance: Math.max(0.4, 0.8 - i * 0.1),
          language: r.languageCode ?? q.language,
          queries: [{ text: q.text, intent: "refute" }],
          fallbackType: "fact_checker",
          preset: {
            publisher,
            excerpt,
            snippet: [r.textualRating, r.title].filter(Boolean).join(": "),
          },
        };
      }),
  );
}

// ---------- ограничение параллельности ----------

/** Тезисы куска проверяются параллельно — без лимита поисковик быстро ответит 429 */
const MAX_PARALLEL = config.limits.searchParallel;
let active = 0;
const waiting: Array<() => void> = [];

/** Замеры очереди к поиску: сколько запросов, сколько ждали свободного слота и сколько шли сами (для логов и бенчмарков) */
export const searchStats = { calls: 0, waitMs: 0, runMs: 0, maxWaitMs: 0 };

export async function limited<T>(fn: () => Promise<T>): Promise<T> {
  const queued = Date.now();
  if (active < MAX_PARALLEL) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve)); // слот передаётся из finally
  const started = Date.now();
  const wait = started - queued;
  searchStats.calls++;
  searchStats.waitMs += wait;
  searchStats.maxWaitMs = Math.max(searchStats.maxWaitMs, wait);
  try {
    return await fn();
  } finally {
    searchStats.runMs += Date.now() - started;
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
