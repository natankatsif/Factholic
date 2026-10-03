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
  /**
   * Структура тезиса: по этим полям сравниваются узлы дерева первоисточника (этапы 05–07).
   * Необязательное, пока этап 03 её не извлекает (TODO backend-1) — без неё этап 05 извлекает структуру сам.
   */
  structure?: ClaimStructure;
}

/** Число из тезиса: «около шестисот тысяч человек» → { value: 600000, unit: "человек", approximate: true, … } */
export interface ClaimNumber {
  value: number;
  /** «человек», «%», «см», «долларов»; "" — безразмерное */
  unit: string;
  /** «около», «более», «до» */
  approximate: boolean;
  /** Как сказано: «около шестисот тысяч» */
  raw: string;
}

/**
 * Маркеры «свежести»: событие подаётся как только что случившееся.
 * Главный сигнал для проверки старого контента (этап 07): «вчера» — а первая публикация три года назад.
 */
export type TimeMarker = "just_now" | "today" | "yesterday" | "this_week" | "recently";

export interface ClaimStructure {
  numbers: ClaimNumber[];
  /** Места в начальной форме: ["Кишинёв", "Молдова"] */
  places: string[];
  /** Когда произошло событие, если названо явно: «в 2022 году», «24 февраля» */
  eventTime: {
    raw: string;
    /** ISO-дата или её начало: "2022", "2022-02", "2022-02-24"; null — по тексту не определить */
    date: string | null;
  } | null;
  timeMarkers: TimeMarker[];
  /** asserted — подаётся как факт; hedged — «возможно», «по слухам», «говорят», «предварительно» */
  certainty: "asserted" | "hedged";
  /** Кому принадлежит утверждение, если спикер его пересказывает: «ВОЗ», «Reuters»; null — от себя */
  attributedTo: string | null;
}

export interface ClaimExtractionOutput {
  claims: Claim[];
}

export const CHECKWORTHINESS_THRESHOLD = 0.6;
