import type { Stage } from "../../pipeline/context.ts";
import type { CaptionsChunk, IngestInput, IngestOutput, MediaChunk } from "./types.ts";

export const mockIngestInput: Omit<IngestInput, "liveAudio"> = {
  jobId: "job_mock_01",
  request: {
    video: {
      pageUrl: "https://www.youtube.com/watch?v=MOCK123",
      platform: "youtube",
      platformVideoId: "MOCK123",
      title: "Большое интервью: экономика, наука и мировые события",
      durationSec: 1860,
    },
    mode: "remote",
    startFrom: 1200,
    languageHint: "ru",
    uiLanguage: "ru",
  },
  chunkSec: 30,
};

/** Пример куска на выходе (здесь — субтитры, т.е. ASR будет пропущен) */
export const mockCaptionsChunk: CaptionsChunk = {
  kind: "captions",
  jobId: "job_mock_01",
  seq: 0,
  range: { start: 1200, end: 1230 },
  language: "ru",
  origin: "auto",
  cues: [
    { start: 1215.2, end: 1220.9, text: "давайте немного о том что происходит в мире" },
    { start: 1221.0, end: 1223.0, text: "в Украине сейчас идёт война" },
    { start: 1223.4, end: 1229.8, text: "и это конечно влияет на цены на всё" },
  ],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_INGEST=mock) =====================

export const ingestMock: Stage<IngestInput, IngestOutput> = async (input) => {
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
