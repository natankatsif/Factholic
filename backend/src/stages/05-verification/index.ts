import type { Stage } from "../../pipeline/context.ts";
import { mockVerificationOutput } from "./mock.ts";
import type { VerificationInput, VerificationOutput } from "./types.ts";

export type * from "./types.ts";

/**
 * TODO(backend-2): реализовать.
 *  LLM (structured output) читает claim + excerpt'ы источников → stance каждого источника → итог.
 *  Score учитывать: согласие источников, их domainReliability, свежесть (для событий).
 */
export const verify: Stage<VerificationInput, VerificationOutput> = async (input) => {
  return { ...mockVerificationOutput, claimId: input.claim.id };
};
