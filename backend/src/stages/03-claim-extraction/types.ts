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
   * Структура утверждения — по этим полям backend-2 сравнивает публикации в дереве и находит,
   * где утверждение исказили: «2 → 200» (numbers), «склад → ТЦ» (places), «вчера» при событии 2023 года (time),
   * «по данным мэрии» → «точно» (certainty). Real-реализация заполняет всегда; optional — ради старых моков.
   */
  structure?: ClaimStructure;
}

export interface ClaimStructure {
  /** Что произошло, коротко: "пожар в торговом центре" */
  event: string;
  /** Числа вместе с тем, что они считают: [{ value: "200", about: "пострадавших" }] */
  numbers: Array<{ value: string; about: string }>;
  /** Места как названы в тексте: ["Кишинёв", "торговый центр рядом с Центральным рынком"] */
  places: string[];
  /**
   * Когда, как сказано в тексте: { text: "вчера", date: "2026-10-02", relative: true }.
   * date (YYYY-MM-DD или YYYY-MM, YYYY) — только если однозначно; относительное время считается
   * от даты публикации материала, а не от сегодняшнего дня. null — время не названо.
   */
  time: { text: string; date: string | null; relative: boolean } | null;
  /**
   * asserted — подано как факт; reported — со ссылкой на источник («по данным мэрии»);
   * hedged — с оговоркой («возможно», «по неподтверждённым данным», «якобы»).
   */
  certainty: "asserted" | "reported" | "hedged";
  /** Слова, по которым определена уверенность: ["по данным мэрии"], ["якобы"] */
  certaintyMarkers: string[];
  /** Кто утверждает внутри текста: "мэрия Кишинёва", "очевидцы". null — сам автор/спикер */
  attributedTo: string | null;
}

export interface ClaimExtractionOutput {
  claims: Claim[];
  /**
   * Если claims пустой (в тексте нет проверяемых фактов — только мнения, приветствия или ерунда),
   * модель генерирует короткую персонализированную реплику чудика.
   */
  replyWhenNoClaims?: string | null;
}

/**
 * Ниже — подробности репортажа, общеизвестное, анонсы: на них не тратим поиск.
 * Шкала — в prompt.ts; при 0.6 проходили «в обратную сторону сильно ограничено» и «город встал в пробках».
 */
export const CHECKWORTHINESS_THRESHOLD = 0.75;
