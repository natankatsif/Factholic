import { selectImpl } from "../../config.ts";
import { extractClaimsMock } from "./mock.ts";
import { extractClaimsReal } from "./real.ts";
import type { ClaimExtractionInput, ClaimExtractionOutput } from "./types.ts";

export type * from "./types.ts";
export { CHECKWORTHINESS_THRESHOLD } from "./types.ts";

/** mock или real — по STAGE_CLAIM_EXTRACTION в .env (см. backend/src/config.ts) */
export const extractClaims = selectImpl<ClaimExtractionInput, ClaimExtractionOutput>("claimExtraction", {
  mock: extractClaimsMock,
  real: extractClaimsReal,
});
