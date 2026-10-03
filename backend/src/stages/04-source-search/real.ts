import { config } from "../../config.ts";
import type { Stage } from "../../pipeline/context.ts";
import { factCheckSearch, limited, tavilySearch, type Candidate } from "./engines.ts";
import { planQueries, type PlannedQuery } from "./queries.ts";
import { dedupe, enrich, selectDiverse, toFoundSource, type Enriched } from "./select.ts";
import { keywordStems } from "./text.ts";
import type { SearchQuery, SourceSearchInput, SourceSearchOutput } from "./types.ts";

interface SearchTask {
  query: SearchQuery;
  run: () => Promise<Candidate[]>;
}

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_SOURCE_SEARCH=real).
 *  1. LLM составляет 3–5 запросов на разных языках, включая запрос на опровержение (queries.ts)
 *  2. Tavily (+ Google Fact Check Tools, если есть ключ) — сразу с текстом страниц (engines.ts)
 *  3. Вырезка excerpt/snippet, справочник доменов, отбор по разнообразию (select.ts, domains.ts, text.ts)
 *
 * Ничего не нашли — пустой sources (этап 05 вернёт unverifiable). Упали все запросы — исключение (failed).
 */
export const searchSourcesReal: Stage<SourceSearchInput, SourceSearchOutput> = async (input, ctx) => {
  const { claim } = input;
  if (config.providers.search.provider !== "tavily") {
    throw new Error(
      `SEARCH_PROVIDER="${config.providers.search.provider}" не поддерживается: этап 04 написан под tavily`,
    );
  }

  const planned = await planQueries(input, ctx);
  const tasks: SearchTask[] = planned.map((q) => ({
    query: { text: q.text, language: q.language, engine: "tavily" },
    run: () => limited(() => tavilySearch(q, ctx.signal)),
  }));
  if (config.providers.factCheck.apiKey) {
    for (const q of factCheckQueries(planned)) {
      tasks.push({
        query: { text: q.text, language: q.language, engine: "factcheck_api" },
        run: () => limited(() => factCheckSearch(q, ctx.signal)),
      });
    }
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const errors = settled.flatMap((s) => (s.status === "rejected" ? [s.reason] : []));
  if (errors.length === settled.length) {
    throw new Error(`04: все поисковые запросы упали: ${String(errors[0])}`);
  }
  for (const err of errors) ctx.log("04: поисковый запрос упал", String(err));

  const candidates = dedupe(settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])));
  const stems = keywordStems(claim.normalized, claim.quote, ...claim.entities);
  const relevant = candidates.map((c) => enrich(c, stems)).filter((e): e is Enriched => e !== null);
  const picked = selectDiverse(relevant, input.maxSources);
  ctx.log(
    `04: ${claim.id}: найдено ${candidates.length}, по теме ${relevant.length}, взято ${picked.length}`,
  );

  const retrievedAt = new Date().toISOString();
  const sources = picked.map((e, i) => toFoundSource(e, `${claim.id}_s${i + 1}`, retrievedAt));
  const pickedUrls = new Map(sources.map((s) => [s.url, s]));

  let copyIdx = sources.length + 1;
  const copies = relevant.map((e) => {
    const existing = pickedUrls.get(e.candidate.url);
    if (existing) return existing;
    return toFoundSource(e, `${claim.id}_c${copyIdx++}`, retrievedAt);
  });

  return {
    claimId: claim.id,
    queries: tasks.map((t) => t.query),
    sources,
    copies,
  };
};

/** У Fact Check API своя выдача: по одному запросу на язык, лучше всего работают короткие. */
function factCheckQueries(planned: PlannedQuery[]): PlannedQuery[] {
  const byLanguage = new Map<string, PlannedQuery>();
  for (const q of planned) if (!byLanguage.has(q.language)) byLanguage.set(q.language, q);
  return [...byLanguage.values()];
}
