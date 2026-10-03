import type { ClaimCategory, ClaimId, JobId, LanguageCode, TimeRange, VideoInfo } from "@news/contracts";
import type { SegmentId, TranscriptSegment } from "../02-transcription/types.ts";

// ===================== ВХОД =====================

export interface ClaimExtractionInput {
  jobId: JobId;
  /** Название видео и т.п. — помогает LLM понять контекст */
  video: VideoInfo;
  /** НОВЫЕ сегменты — из них извлекаем тезисы */
  segments: TranscriptSegment[];
  /**
   * Предыдущие ~60 с транскрипта — ТОЛЬКО для контекста (местоимения, "он сказал, что…").
   * Из них тезисы не извлекаем, они уже обработаны.
   */
  context: TranscriptSegment[];
  /** Уже найденные тезисы — чтобы не дублировать, если спикер повторяется */
  previousClaims: Array<Pick<Claim, "id" | "normalized">>;
  language: LanguageCode;
}

// ===================== ВЫХОД =====================

/** Проверяемый тезис */
export interface Claim {
  id: ClaimId;
  jobId: JobId;
  /** Точный отрезок, где тезис произносится (по words из этапа 02) */
  range: TimeRange;
  /** Дословно из транскрипта */
  quote: string;
  /**
   * Самодостаточная переформулировка, понятная без контекста видео.
   * "он там говорил, что их стало больше 8 млрд" → "Население Земли превысило 8 млрд человек в 2022 году."
   */
  normalized: string;
  category: ClaimCategory;
  /**
   * 0..1 — насколько тезис стоит проверять (конкретный факт = высоко, мнение/шутка = низко).
   * Оркестратор отправляет дальше только те, что >= CHECKWORTHINESS_THRESHOLD.
   */
  checkworthiness: number;
  language: LanguageCode;
  /** Ключевые сущности — пригодятся для поиска: ["Украина"] */
  entities: string[];
  /** Из каких сегментов собран тезис */
  segmentIds: SegmentId[];
  speaker?: string;
}

export interface ClaimExtractionOutput {
  claims: Claim[];
}

export const CHECKWORTHINESS_THRESHOLD = 0.6;
