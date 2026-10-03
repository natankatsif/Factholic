import type { FactCheck, SourceCard } from "@news/contracts";
import type { FoundSource } from "../04-source-search/types.ts";
import type { SourceAssessment } from "../05-verification/types.ts";
import type { DeliveryInput, DeliveryOutput } from "./types.ts";

export type * from "./types.ts";

/** Источники с relevance ниже — не показываем */
const MIN_RELEVANCE = 0.3;

/** Чистая функция: внутренние типы пайплайна → модель для фронта. */
export function toFactCheck(input: DeliveryInput): DeliveryOutput {
  const { claim } = input;
  const base: FactCheck = {
    id: claim.id,
    status: "checking",
    range: claim.range,
    quote: claim.quote,
    claim: claim.normalized,
    category: claim.category,
    speaker: claim.speaker,
    consensus: "unverifiable",
    flags: [],
    verdict: null,
    sources: [],
  };

  switch (input.kind) {
    case "pending":
      return base;
    case "failed":
      return { ...base, status: "failed", error: input.error };
    case "checked": {
      const v = input.verification;
      const byId = new Map(v.sourceAssessments.map((a) => [a.sourceId, a]));
      const sources = input.sources
        .filter((s) => (byId.get(s.id)?.relevance ?? 0) >= MIN_RELEVANCE)
        .sort((a, b) => byId.get(b.id)!.relevance - byId.get(a.id)!.relevance)
        .map((s) => toSourceCard(s, byId.get(s.id)!));
      return {
        ...base,
        status: "done",
        verdict: {
          score: v.score,
          label: v.label,
          confidence: v.confidence,
          summary: v.summary,
          explanation: v.explanation,
        },
        sources,
        checkedAt: v.checkedAt,
      };
    }
  }
}

function toSourceCard(s: FoundSource, a: SourceAssessment): SourceCard {
  return {
    id: s.id,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    domain: s.domain,
    faviconUrl: `https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`,
    sourceType: s.sourceType,
    publishedAt: s.publishedAt,
    language: s.language,
    country: s.country,
    snippet: s.snippet,
    stance: a.stance,
  };
}
