import type { JobId, LanguageCode, Seconds, TimeRange } from "@news/contracts";
import type { MediaChunk } from "../01-ingest/types.ts";

// ===================== ВХОД =====================

/** Один кусок из этапа 01 (звук или готовые субтитры) */
export interface TranscriptionInput {
  chunk: MediaChunk;
  /** Подсказка языка, если известна — ускоряет и улучшает ASR */
  languageHint?: LanguageCode;
}

// ===================== ВЫХОД =====================

export type SegmentId = string;

export interface TranscriptWord {
  text: string;
  start: Seconds;
  end: Seconds;
  confidence?: number;
}

/** Фраза/предложение с абсолютными таймкодами видео */
export interface TranscriptSegment {
  /** Уникален в рамках job: `${seq}_${index}` */
  id: SegmentId;
  start: Seconds;
  end: Seconds;
  text: string;
  /** "SPEAKER_1" от диаризации или имя, если удалось определить */
  speaker?: string;
  confidence?: number;
  /** Пословные таймкоды — нужны, чтобы точно вырезать range тезиса на этапе 03 */
  words?: TranscriptWord[];
}

export interface TranscriptionOutput {
  jobId: JobId;
  seq: number;
  range: TimeRange;
  language: LanguageCode;
  /** asr — распознали сами, captions — взяли субтитры платформы, text — статья или вставленный текст */
  origin: "asr" | "captions" | "text";
  segments: TranscriptSegment[];
}
