import type { Stage } from "../../pipeline/context.ts";
import { mockCaptionsChunk } from "../01-ingest/mock.ts";
import { cuesToWords, textToSegments, wordsToSegments } from "./sentences.ts";
import type { TranscriptionInput, TranscriptionOutput } from "./types.ts";

export const mockTranscriptionInput: TranscriptionInput = {
  chunk: mockCaptionsChunk,
  languageHint: "ru",
};

export const mockTranscriptionOutput: TranscriptionOutput = {
  jobId: "job_mock_01",
  seq: 0,
  range: { start: 1200, end: 1230 },
  language: "ru",
  origin: "captions",
  segments: [
    {
      id: "0_0",
      start: 1215.2,
      end: 1220.9,
      text: "Давайте немного о том, что происходит в мире.",
      speaker: "SPEAKER_1",
    },
    {
      id: "0_1",
      start: 1221.0,
      end: 1223.0,
      text: "В Украине сейчас идёт война,",
      speaker: "SPEAKER_1",
      words: [
        { text: "В", start: 1221.0, end: 1221.1 },
        { text: "Украине", start: 1221.1, end: 1221.6 },
        { text: "сейчас", start: 1221.6, end: 1222.0 },
        { text: "идёт", start: 1222.0, end: 1222.4 },
        { text: "война", start: 1222.4, end: 1223.0 },
      ],
    },
    {
      id: "0_2",
      start: 1223.4,
      end: 1229.8,
      text: "и это, конечно, влияет на цены на всё.",
      speaker: "SPEAKER_1",
    },
  ],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_TRANSCRIPTION=mock) =====================

/**
 * Субтитры и текст режем на предложения тем же кодом, что real (внешних API там нет), — мок этапа 03 узнаёт
 * в них демо-тезисы. Звук и картинку распознавать нечем — пример транскрипта.
 */
export const transcribeMock: Stage<TranscriptionInput, TranscriptionOutput> = async ({
  chunk,
  languageHint,
}) => {
  const base = { jobId: chunk.jobId, seq: chunk.seq, range: chunk.range };
  if (chunk.kind === "captions") {
    return {
      ...base,
      language: chunk.language,
      origin: "captions",
      segments: wordsToSegments(cuesToWords(chunk.cues), chunk.seq),
    };
  }
  if (chunk.kind === "text") {
    return {
      ...base,
      language: chunk.language ?? languageHint ?? "und",
      origin: "text",
      segments: textToSegments(chunk.text, chunk.seq),
    };
  }
  return { ...mockTranscriptionOutput, ...base };
};
