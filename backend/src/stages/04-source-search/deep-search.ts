/**
 * Режим «ищем до последнего» (DEEP_SEARCH=on): если публикаций мало, поиск повторяется целиком с новыми запросами.
 * Всего не больше MAX_SEARCH_PASSES заходов. После этого честно отдаём то, что есть: выдумывать цепочку нельзя.
 */
import type { CopiesResult } from "./copies.ts";
import type { PlannedQuery } from "./queries.ts";
import type { SourceCopy } from "./types.ts";

export const MAX_SEARCH_PASSES = 3;
/** Меньше публикаций по этой истории — ищем ещё */
export const MIN_PUBLICATIONS = 5;

function urlKey(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.|m\.)?/, "")
    .replace(/[#?].*$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/** Копии всех заходов без повторов, по дате, с новыми id: в каждом заходе счёт шёл заново */
export function mergeCopies(claimId: string, lists: SourceCopy[][]): SourceCopy[] {
  const byUrl = new Map<string, SourceCopy>();
  for (const copy of lists.flat()) if (!byUrl.has(urlKey(copy.url))) byUrl.set(urlKey(copy.url), copy);
  return [...byUrl.values()]
    .sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999"))
    .map((copy, i) => ({ ...copy, id: `${claimId}_c${i + 1}` }));
}

export interface DeepSearchSteps {
  /** Новые запросы по тому, что уже искали и нашли. Пусто — искать больше нечего */
  plan: (used: string[], found: SourceCopy[]) => Promise<PlannedQuery[]>;
  run: (queries: PlannedQuery[]) => Promise<CopiesResult>;
  log: (message: string) => void;
}

export async function searchUntilFound(
  claimId: string,
  first: CopiesResult,
  used: string[],
  { plan, run, log }: DeepSearchSteps,
): Promise<CopiesResult & { passes: number }> {
  let copies = first.copies;
  let passes = 1;
  const tried = [...used];
  while (copies.length < MIN_PUBLICATIONS && passes < MAX_SEARCH_PASSES) {
    const queries = await plan(tried, copies);
    if (!queries.length) break;
    passes++;
    log(
      `04: ${claimId}: публикаций ${copies.length}, заход ${passes}: ${queries.map((q) => q.text).join("; ")}`,
    );
    tried.push(...queries.map((q) => q.text));
    copies = mergeCopies(claimId, [copies, (await run(queries)).copies]);
  }
  return { ...first, copies, passes };
}
