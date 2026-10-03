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

/** 1 источник, 2 источника, 5 источников */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
