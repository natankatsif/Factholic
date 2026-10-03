/**
 * Протокол расширение <-> бэкенд.
 *
 *  1. POST /api/jobs            StartAnalysisRequest -> StartAnalysisResponse
 *  2. WS   /api/jobs/:id/events сервер шлёт ServerEvent, клиент шлёт ClientMessage
 *  3. GET  /api/jobs/:id        -> VideoReport (снапшот, например после перезагрузки страницы)
 */
import type { JobId, LanguageCode, Seconds, TimeRange, VideoInfo, VideoRef } from "./common.ts";
import type { FactCheck, VideoReport } from "./fact-check.ts";

export const API_ROUTES = {
  startJob: "/api/jobs",
  getJob: (jobId: JobId) => `/api/jobs/${jobId}`,
  events: (jobId: JobId) => `/api/jobs/${jobId}/events`,
} as const;

/**
 * remote — бэкенд сам скачивает видео/субтитры по URL (YouTube и т.п.). Быстро, можно обработать наперёд.
 * live   — бэкенд не может скачать (blob:, DRM, закрытый сайт) → расширение захватывает звук
 *          вкладки и шлёт его кусками через WS (ClientMessage "audio.chunk").
 */
export type AnalysisMode = "remote" | "live";

export interface StartAnalysisRequest {
  video: VideoRef;
  mode: AnalysisMode;
  /** С какой секунды пользователь сейчас смотрит — бэкенд начнёт отсюда */
  startFrom: Seconds;
  /** Язык речи, если известен (из атрибутов страницы/субтитров) */
  languageHint?: LanguageCode;
  /** На каком языке писать summary/explanation */
  uiLanguage: LanguageCode;
}

export interface StartAnalysisResponse {
  jobId: JobId;
  /** Полный ws(s):// URL для подписки на события */
  eventsUrl: string;
  /** true — это видео уже проверялось, результат из кэша (сразу придёт job.completed) */
  cached: boolean;
}

// ---------- сервер -> клиент ----------

export type PipelineStage =
  "ingest" | "transcription" | "claim_extraction" | "source_search" | "verification";

export type ServerEvent =
  | { type: "job.started"; jobId: JobId; video: VideoInfo }
  /** Прогресс обработки по таймлайну видео */
  | { type: "job.progress"; jobId: JobId; processedUntil: Seconds; stage: PipelineStage }
  /** Найден тезис, проверка началась. factCheck.status = "checking" */
  | { type: "claim.detected"; jobId: JobId; factCheck: FactCheck }
  /** Проверка закончилась. factCheck.status = "done" | "failed". Заменяет объект с тем же id */
  | { type: "claim.checked"; jobId: JobId; factCheck: FactCheck }
  | { type: "job.completed"; jobId: JobId; report: VideoReport }
  | { type: "job.failed"; jobId: JobId; error: ApiError };

// ---------- клиент -> сервер ----------

export type ClientMessage =
  /** Позиция плеера — бэкенд приоритизирует куски рядом с ней (перемотка!) */
  | { type: "playback"; currentTime: Seconds; playing: boolean; rate: number }
  /** Только в mode = "live" */
  | {
      type: "audio.chunk";
      seq: number;
      range: TimeRange;
      mimeType: "audio/webm;codecs=opus" | "audio/wav";
      dataBase64: string;
    }
  | { type: "cancel" };

export interface ApiError {
  code: "VIDEO_UNAVAILABLE" | "UNSUPPORTED_PLATFORM" | "TRANSCRIPTION_FAILED" | "RATE_LIMITED" | "INTERNAL";
  message: string;
}
