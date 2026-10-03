import type { Stage } from "../../pipeline/context.ts";
import { mockClaimExtractionOutput } from "./mock.ts";
import type { ClaimExtractionInput, ClaimExtractionOutput } from "./types.ts";

export type * from "./types.ts";
export { CHECKWORTHINESS_THRESHOLD } from "./types.ts";

/**
 * TODO(backend-2): реализовать.
 *  LLM со structured output (JSON по схеме Claim) → по quote найти words в сегментах → точный range.
 */
export const extractClaims: Stage<ClaimExtractionInput, ClaimExtractionOutput> = async (input) => {
  return {
    claims: mockClaimExtractionOutput.claims.map((c) => ({ ...c, jobId: input.jobId })),
  };
};
