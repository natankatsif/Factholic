/**
 * Веб-поиск для ассистента: один запрос к Tavily, короткие выдержки со ссылками и датами.
 * Tavily отказал (кончилась квота — HTTP 432, сбой сети) — тот же запрос через встроенный web search OpenAI.
 * Отдельно от этапа 04: там поиск под дерево (много запросов, полный текст страниц), здесь — быстрый ответ в чат.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { config } from "../config.ts";

const TIMEOUT_MS = 20_000;
const MAX_RESULTS = 5;
const SNIPPET_CHARS = 600;

export interface WebSearchResult {
  title: string;
  url: string;
  publishedAt?: string;
  snippet: string;
}

export interface WebSearchOutput {
  query: string;
  engine: "tavily" | "openai";
  results: WebSearchResult[];
  /** Только у OpenAI: краткая сводка найденного (выдержек по каждой ссылке он не отдаёт) */
  summary?: string;
}

export async function search(
  query: string,
  opts: { news: boolean; signal?: AbortSignal; log: (msg: string, data?: unknown) => void },
): Promise<WebSearchOutput> {
  if (!config.providers.search.apiKey || Date.now() < tavilyOffUntil) return openaiSearch(query, opts.signal);
  try {
    return { query, engine: "tavily", results: await tavilySearch(query, opts) };
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    // кончилась квота — не стучимся в Tavily на каждый вопрос, сразу идём в OpenAI
    if (err instanceof Error && err.message.startsWith("Tavily 432"))
      tavilyOffUntil = Date.now() + QUOTA_PAUSE_MS;
    opts.log("Tavily не ответил, ищем через OpenAI", String(err));
    return openaiSearch(query, opts.signal);
  }
}

/** Пауза после «квота исчерпана» (HTTP 432): новый ключ подхватится при перезапуске сервера */
const QUOTA_PAUSE_MS = 30 * 60_000;
let tavilyOffUntil = 0;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

async function tavilySearch(
  query: string,
  { news, signal }: { news: boolean; signal?: AbortSignal },
): Promise<WebSearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.providers.search.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: news ? "news" : "general",
      max_results: MAX_RESULTS,
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
      : AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as { results?: TavilyResult[] };
  return (body.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    ...(r.published_date ? { publishedAt: r.published_date } : {}),
    snippet: r.content.replace(/\s+/g, " ").slice(0, SNIPPET_CHARS),
  }));
}

/** Встроенный web search OpenAI (Responses API): ссылки — из sources ответа, содержание — в summary */
async function openaiSearch(query: string, signal?: AbortSignal): Promise<WebSearchOutput> {
  const openai = createOpenAI({ apiKey: config.providers.llm.apiKey });
  const result = await generateText({
    model: openai(config.providers.llm.model),
    tools: { web_search: openai.tools.webSearch({ searchContextSize: "low" }) },
    instructions:
      "Найди в интернете публикации по запросу. Ответь кратко фактами: кто, что, когда (с датами публикаций). " +
      "Не делай выводов, которых нет в источниках.",
    prompt: query,
    // поиск с низким усилием ~6,5 с вместо ~10,5 с
    providerOptions: { openai: { reasoningEffort: "low" } },
    abortSignal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
  });
  const seen = new Set<string>();
  const results = result.sources
    .flatMap((s) => (s.sourceType === "url" ? [s] : []))
    .filter((s) => !seen.has(s.url) && seen.add(s.url))
    .slice(0, MAX_RESULTS)
    .map((s) => ({ title: s.title || new URL(s.url).hostname, url: s.url, snippet: "" }));
  return { query, engine: "openai", results, summary: result.text.slice(0, 2000) };
}
