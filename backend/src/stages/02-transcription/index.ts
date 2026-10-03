import type { Stage } from "../../pipeline/context.ts";
import { mockTranscriptionOutput } from "./mock.ts";
import type { TranscriptionInput, TranscriptionOutput } from "./types.ts";

export type * from "./types.ts";

/**
 * TODO(backend-1): реализовать.
 *  captions → склеить cues в предложения, проставить id
 *  audio    → ASR (Whisper / Deepgram / AssemblyAI) с word-level timestamps,
 *             сдвинуть все таймкоды на chunk.range.start
 */
export const transcribe: Stage<TranscriptionInput, TranscriptionOutput> = async ({ chunk }) => {
  return { ...mockTranscriptionOutput, jobId: chunk.jobId, seq: chunk.seq, range: chunk.range };
};
