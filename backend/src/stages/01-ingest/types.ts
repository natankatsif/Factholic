import type {
  JobId,
  LanguageCode,
  Seconds,
  StartAnalysisRequest,
  TimeRange,
  VideoInfo,
} from "@news/contracts";

// ===================== ВХОД =====================

export interface IngestInput {
  jobId: JobId;
  /** Ровно то, что прислало расширение в POST /api/jobs */
  request: StartAnalysisRequest;
  /**
   * Только для mode = "live": куски звука, которые расширение шлёт через WS.
   * Для mode = "remote" — undefined, этап сам качает по request.video.pageUrl.
   */
  liveAudio?: AsyncIterable<LiveAudioChunk>;
  /** Длина куска, на которые резать звук (рекомендуется 15–30 с) */
  chunkSec: Seconds;
}

export interface LiveAudioChunk {
  seq: number;
  range: TimeRange;
  mimeType: string;
  data: Uint8Array;
}

// ===================== ВЫХОД =====================

export interface IngestOutput {
  /** Метаданные видео (название, длительность, язык) — сразу уходят на фронт в job.started */
  video: VideoInfo;
  /**
   * Поток кусков по порядку, начиная с request.startFrom.
   * Если у видео есть субтитры (YouTube) — отдаём CaptionsChunk и пропускаем ASR.
   */
  chunks: AsyncIterable<MediaChunk>;
}

export type MediaChunk = AudioChunk | CaptionsChunk | TextChunk;

/** Кусок звука, который надо распознать */
export interface AudioChunk {
  kind: "audio";
  jobId: JobId;
  /** Порядковый номер куска, с 0 */
  seq: number;
  /** Где этот кусок лежит на таймлайне видео */
  range: TimeRange;
  format: "wav" | "mp3" | "webm" | "opus";
  sampleRate: number; // 16000 оптимально для ASR
  channels: 1 | 2;
  data: Uint8Array;
}

/** Готовые субтитры с платформы — распознавать не нужно */
export interface CaptionsChunk {
  kind: "captions";
  jobId: JobId;
  seq: number;
  range: TimeRange;
  language: LanguageCode;
  /** manual — загружены автором (точнее), auto — автосубтитры платформы */
  origin: "manual" | "auto";
  cues: Array<{ start: Seconds; end: Seconds; text: string }>;
}

/**
 * Готовый текст — статья по ссылке или вставленный пост. Ни ASR, ни таймкодов:
 * range = { start: 0, end: 0 }, порядок задаёт seq. Длинный текст режется на куски по абзацам.
 */
export interface TextChunk {
  kind: "text";
  jobId: JobId;
  seq: number;
  range: TimeRange;
  /** Язык, если известен (подсказка от клиента или разметка страницы) */
  language?: LanguageCode;
  /** article — вытащили со страницы по ссылке, pasted — пользователь вставил сам */
  origin: "article" | "pasted";
  text: string;
}
