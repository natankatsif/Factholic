import { config } from "../../config.ts";
import type { Stage } from "../../pipeline/context.ts";
import type { VerificationInput, VerificationOutput } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_VERIFICATION=real). TODO(backend-2)
 *  LLM (config.providers.llm, structured output) читает claim + excerpt'ы → stance каждого источника → итог.
 *  Score учитывает: согласие источников, их domainReliability, свежесть (для событий).
 */
export const verifyReal: Stage<VerificationInput, VerificationOutput> = async () => {
  const { provider, model } = config.providers.llm;
  throw new Error(`05-verification: real-реализация (${provider}/${model}) ещё не написана (TODO backend-2)`);
};
