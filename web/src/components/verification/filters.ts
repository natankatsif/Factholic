import type { FactCheck } from "@news/contracts";

/** Фильтры утверждений: стороны (consensus) и флаги */
export type ClaimFilter = "all" | "converge" | "split" | "against" | "flagged" | "exaggerated" | "outdated";

export function matchesFilter(fc: FactCheck, filter: ClaimFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "flagged":
      return fc.consensus === "flagged" || fc.flags.length > 0;
    case "exaggerated":
    case "outdated":
      return fc.flags.some((f) => f.type === filter);
    default:
      return fc.consensus === filter;
  }
}

export type FilterCounts = Record<ClaimFilter, number>;

export function countFilters(factChecks: FactCheck[]): FilterCounts {
  const filters: ClaimFilter[] = [
    "all",
    "converge",
    "split",
    "against",
    "flagged",
    "exaggerated",
    "outdated",
  ];
  return Object.fromEntries(
    filters.map((f) => [f, factChecks.filter((fc) => matchesFilter(fc, f)).length]),
  ) as FilterCounts;
}
