import { selectImpl } from "../../config.ts";
import { transcribeMock } from "./mock.ts";
import { transcribeReal } from "./real.ts";
import type { TranscriptionInput, TranscriptionOutput } from "./types.ts";

export type * from "./types.ts";

/** mock или real — по STAGE_TRANSCRIPTION в .env (см. backend/src/config.ts) */
export const transcribe = selectImpl<TranscriptionInput, TranscriptionOutput>("transcription", {
  mock: transcribeMock,
  real: transcribeReal,
});
