import type { Stage } from "../../pipeline/context.ts";
import type { IngestInput, IngestOutput } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_INGEST=real). TODO(backend-1)
 *  remote: yt-dlp → субтитры если есть, иначе аудио → ffmpeg (16kHz mono) → нарезка по chunkSec
 *  live:   склеить/перекодировать input.liveAudio в AudioChunk
 */
export const ingestReal: Stage<IngestInput, IngestOutput> = async () => {
  throw new Error("01-ingest: real-реализация ещё не написана (TODO backend-1). Поставь STAGE_INGEST=mock");
};
