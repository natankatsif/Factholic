import { config } from "../../config.ts";
import type { Stage } from "../../pipeline/context.ts";
import type { ClaimExtractionInput, ClaimExtractionOutput } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_CLAIM_EXTRACTION=real). TODO(backend-2)
 *  LLM (config.providers.llm) со structured output по схеме Claim → по quote найти words в сегментах → точный range.
 */
export const extractClaimsReal: Stage<ClaimExtractionInput, ClaimExtractionOutput> = async () => {
  const { provider, model } = config.providers.llm;
  throw new Error(
    `03-claim-extraction: real-реализация (${provider}/${model}) ещё не написана (TODO backend-2)`,
  );
};
