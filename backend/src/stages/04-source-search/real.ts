import { config } from "../../config.ts";
import type { Stage, StageContext } from "../../pipeline/context.ts";
import { findCopies } from "./copies.ts";
import { factCheckSearch, limited, tavilySearch, type Candidate } from "./engines.ts";
import { planFollowUpQueries, planQueries, type PlannedQuery } from "./queries.ts";
import { dedupe, enrich, registrableDomain, selectDiverse, toFoundSource, type Enriched } from "./select.ts";
import { assessSufficiency, type Sufficiency } from "./sufficiency.ts";
import { keywordStems } from "./text.ts";
import type { SearchQuery, SourceSearchInput, SourceSearchOutput } from "./types.ts";

/** Максимум раундов поиска: первый + до двух прицельных */
export const MAX_ROUNDS = 3;

interface SearchTask {
  query: SearchQuery;
  run: () => Promise<Candidate[]>;
}

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_SOURCE_SEARCH=real). «Умный» поиск до MAX_ROUNDS раундов:
 *  1. LLM составляет 3–5 запросов на разных языках, включая запрос на опровержение (queries.ts)
 *  2. Tavily (+ Google Fact Check Tools, если есть ключ) — сразу с текстом страниц (engines.ts)
 *  3. Вырезка excerpt/snippet, справочник доменов (select.ts, domains.ts, text.ts)
 *  4. Код проверяет, хватает ли найденного (sufficiency.ts): независимые сайты, официальный источник,
 *     числа из утверждения. Не хватает → LLM придумывает до 2 прицельных запросов → следующий раунд.
 *  5. Отбор по разнообразию из всего найденного за все раунды
 *  Параллельно — copies: все перепечатки для дерева (copies.ts). Упал поиск копий — copies пустой.
 *
 * Итог раундов — в search: что не удалось подтвердить (unconfirmed) этап 09 покажет как «недостаточно информации».
 * Упали все запросы первого раунда — исключение (failed).
 */
export const searchSourcesReal: Stage<SourceSearchInput, SourceSearchOutput> = async (input, ctx) => {
  const { claim } = input;
  if (config.providers.search.provider !== "tavily") {
    throw new Error(
      `SEARCH_PROVIDER="${config.providers.search.provider}" не поддерживается: этап 04 написан под tavily`,
    );
  }

  const t0 = Date.now();
  const planned = await planQueries(input, ctx);
  const tPlanned = Date.now();
  const copiesPromise = findCopies(claim, planned, ctx).catch((err: unknown) => {
    if (ctx.signal.aborted) return [];
    ctx.log("04 copies: упал поиск копий", String(err));
    return [];
  });

  const stems = keywordStems(claim.normalized, claim.quote, ...claim.entities);
  const queries: SearchQuery[] = [];
  let candidates: Candidate[] = [];
  let relevant: Enriched[] = [];
  let verdict: Sufficiency = { sufficient: false, unconfirmed: [], gaps: [] };
  let round = 0;
  let next: PlannedQuery[] = planned;

  while (next.length && round < MAX_ROUNDS) {
    round++;
    const tasks = searchTasks(next, round === 1, ctx);
    queries.push(...tasks.map((t) => t.query));
    const settled = await Promise.allSettled(tasks.map((t) => t.run()));
    const errors = settled.flatMap((s) => (s.status === "rejected" ? [s.reason] : []));
    if (round === 1 && errors.length === settled.length) {
      throw new Error(`04: все поисковые запросы упали: ${String(errors[0])}`);
    }
    for (const err of errors) ctx.log("04: поисковый запрос упал", String(err));

    candidates = dedupe([
      ...candidates,
      ...settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])),
    ]);
    relevant = candidates.map((c) => enrich(c, stems)).filter((e): e is Enriched => e !== null);
    verdict = assessSufficiency(claim, relevant);
    if (verdict.sufficient || round === MAX_ROUNDS) break;

    const missing = [...verdict.unconfirmed, ...verdict.gaps];
    ctx.log(`04: ${claim.id}: раунд ${round} — не хватает: ${missing.join("; ")}`);
    const sites = [...new Set(relevant.map((e) => registrableDomain(e.domain)))];
    next = await planFollowUpQueries(
      input,
      missing,
      queries.map((q) => q.text),
      sites,
      ctx,
    );
  }
  const tSources = Date.now();

  const picked = selectDiverse(relevant, input.maxSources);
  ctx.log(
    `04: ${claim.id}: раундов ${round}, найдено ${candidates.length}, по теме ${relevant.length}, ` +
      `взято ${picked.length}${verdict.unconfirmed.length ? `, не подтверждено: ${verdict.unconfirmed.join("; ")}` : ""}`,
  );

  const retrievedAt = new Date().toISOString();
  return {
    claimId: claim.id,
    queries,
    sources: picked.map((e, i) => toFoundSource(e, `${claim.id}_s${i + 1}`, retrievedAt)),
    search: { rounds: round, ...verdict },
    copies: await copiesPromise.then((copies) => {
      ctx.log(
        `⏱ 04 ${claim.id}: запросы LLM ${ms(tPlanned - t0)}, источники (${round} р.) ${ms(tSources - tPlanned)}, ` +
          `копии готовы через ${ms(Date.now() - tPlanned)}, всего ${ms(Date.now() - t0)}`,
      );
      return copies;
    }),
  };
};

/** Запросы раунда: Tavily на каждый; Fact Check API — только в первом раунде (по одному на язык) */
function searchTasks(planned: PlannedQuery[], firstRound: boolean, ctx: StageContext): SearchTask[] {
  const tasks: SearchTask[] = planned.map((q) => ({
    query: { text: q.text, language: q.language, engine: "tavily" },
    run: () => limited(() => tavilySearch(q, ctx.signal)),
  }));
  if (firstRound && config.providers.factCheck.apiKey) {
    for (const q of factCheckQueries(planned)) {
      tasks.push({
        query: { text: q.text, language: q.language, engine: "factcheck_api" },
        run: () => limited(() => factCheckSearch(q, ctx.signal)),
      });
    }
  }
  return tasks;
}

/** У Fact Check API своя выдача: по одному запросу на язык, лучше всего работают короткие. */
function factCheckQueries(planned: PlannedQuery[]): PlannedQuery[] {
  const byLanguage = new Map<string, PlannedQuery>();
  for (const q of planned) if (!byLanguage.has(q.language)) byLanguage.set(q.language, q);
  return [...byLanguage.values()];
}

function ms(n: number): string {
  return `${(n / 1000).toFixed(1)}с`;
}
