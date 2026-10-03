import { config } from "../../config.ts";
import type { Stage } from "../../pipeline/context.ts";
import type { TranscriptionInput, TranscriptionOutput } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_TRANSCRIPTION=real). TODO(backend-1)
 *  captions → склеить cues в предложения, проставить id
 *  audio    → ASR (config.providers.asr) с word-level timestamps, сдвинуть таймкоды на chunk.range.start
 */
export const transcribeReal: Stage<TranscriptionInput, TranscriptionOutput> = async () => {
  const { provider } = config.providers.asr;
  throw new Error(`02-transcription: real-реализация (${provider}) ещё не написана (TODO backend-1)`);
};
