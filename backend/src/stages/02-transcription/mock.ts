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
  range: { start: 0, end: 30 },
  language: "ru",
  origin: "captions",
  segments: [
    {
      id: "0_0",
      start: 0.5,
      end: 3.8,
      text: "Здравствуйте, в эфире новости Молдовы и обзор главных событий дня.",
      speaker: "SPEAKER_1",
    },
    {
      id: "0_1",
      start: 4.2,
      end: 11.6,
      text: "В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение парализовано.",
      speaker: "SPEAKER_1",
      words: [
        { text: "В", start: 4.2, end: 4.4 },
        { text: "Кишинёве", start: 4.4, end: 5.1 },
        { text: "из-за", start: 5.1, end: 5.5 },
        { text: "сильного", start: 5.5, end: 6.1 },
        { text: "ливня", start: 6.1, end: 6.6 },
        { text: "затопило", start: 6.6, end: 7.3 },
        { text: "улицу", start: 7.3, end: 7.8 },
        { text: "Албишоара,", start: 7.8, end: 8.8 },
        { text: "движение", start: 8.9, end: 9.6 },
        { text: "парализовано.", start: 9.7, end: 11.6 },
      ],
    },
    {
      id: "0_2",
      start: 12.0,
      end: 17.0,
      text: "Вода залила проезжую часть, коммунальные службы работают в экстренном режиме.",
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
