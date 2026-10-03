import type { Stage } from "../../pipeline/context.ts";
import { mockCaptionsChunk } from "./mock.ts";
import type { IngestInput, IngestOutput, MediaChunk } from "./types.ts";

export type * from "./types.ts";

/**
 * TODO(backend-1): реализовать.
 *  remote: yt-dlp → субтитры если есть, иначе аудио → ffmpeg (16kHz mono) → нарезка по chunkSec
 *  live:   склеить/перекодировать input.liveAudio в AudioChunk
 */
export const ingest: Stage<IngestInput, IngestOutput> = async (input) => {
  const { video } = input.request;
  async function* chunks(): AsyncIterable<MediaChunk> {
    yield { ...mockCaptionsChunk, jobId: input.jobId };
  }
  return {
    video: {
      pageUrl: video.pageUrl,
      platform: video.platform,
      platformVideoId: video.platformVideoId,
      title: video.title ?? "Без названия",
      durationSec: video.durationSec ?? 0,
      language: input.request.languageHint ?? "ru",
    },
    chunks: chunks(),
  };
};
