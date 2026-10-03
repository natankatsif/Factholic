/**
 * Протокол расширение <-> бэкенд.
 *
 *  1. POST /api/jobs            StartAnalysisRequest -> StartAnalysisResponse
 *  2. WS   /api/jobs/:id/events сервер шлёт ServerEvent, клиент шлёт ClientMessage
 *  3. GET  /api/jobs/:id        -> VideoReport (снапшот, например после перезагрузки страницы)
 *  4. POST /api/jobs/:id/chat   чат по разбору: протокол AI SDK (useChat), тело { messages, claimId? }
 */
import type { ClaimId, JobId, LanguageCode, Seconds, TimeRange, VideoInfo, VideoRef } from "./common.ts";
import type { FactCheck, VideoReport } from "./fact-check.ts";

export const API_ROUTES = {
  startJob: "/api/jobs",
  getJob: (jobId: JobId) => `/api/jobs/${jobId}`,
  events: (jobId: JobId) => `/api/jobs/${jobId}/events`,
  chat: (jobId: JobId) => `/api/jobs/${jobId}/chat`,
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
  /**
   * Вставленный текст (статья, пост) вместо видео. Если задан — бэкенд анализирует его, а не скачивает
   * video.pageUrl (туда можно положить ссылку на оригинал поста, если она есть; platform: "generic").
   */
  text?: string;
  /**
   * Загруженная картинка (скриншот поста, фото газеты) как data URL: "data:image/png;base64,…".
   * Бэкенд распознаёт текст (OCR) и анализирует его как статью. Ссылку на картинку можно передать и в video.pageUrl.
   */
  imageDataUrl?: string;
}

export interface StartAnalysisResponse {
  jobId: JobId;
  /** Полный ws(s):// URL для подписки на события */
  eventsUrl: string;
  /** true — это видео уже проверялось, результат из кэша (сразу придёт job.completed) */
  cached: boolean;
}

// ---------- сервер -> клиент ----------

/**
 * Этап по материалу целиком (job.progress.stage, он же VideoReport.stage):
 * transcription / claim_extraction — идут куски; verification — весь материал расшифрован и разобран
 * на утверждения, остались только проверки тезисов. ingest и source_search — для совместимости, бэкенд их не шлёт.
 */
export type PipelineStage =
  "ingest" | "transcription" | "claim_extraction" | "source_search" | "verification";

/** Этап проверки одного тезиса (claim.progress, он же FactCheck.stage): поиск → дерево → стороны */
export type ClaimStage = "source_search" | "provenance" | "stances";

export type ServerEvent =
  | { type: "job.started"; jobId: JobId; video: VideoInfo }
  /** Прогресс обработки по таймлайну видео */
  | { type: "job.progress"; jobId: JobId; processedUntil: Seconds; stage: PipelineStage }
  /** Найден тезис, проверка началась. factCheck.status = "checking" */
  | { type: "claim.detected"; jobId: JobId; factCheck: FactCheck }
  /**
   * Проверка тезиса перешла на следующий этап (для шагов прогресса).
   * sourcesFound — сколько источников нашёл поиск (приходит с этапа provenance, когда поиск закончен)
   */
  | { type: "claim.progress"; jobId: JobId; claimId: ClaimId; stage: ClaimStage; sourcesFound?: number }
  /** Проверка закончилась. factCheck.status = "done" | "failed". Заменяет объект с тем же id */
  | { type: "claim.checked"; jobId: JobId; factCheck: FactCheck }
  | { type: "job.completed"; jobId: JobId; report: VideoReport }
  | { type: "job.failed"; jobId: JobId; error: ApiError }
  /** Ответ AI ассистента на вопрос в карточке разбора */
  | { type: "question.answered"; jobId: JobId; question: string; answer: string; claimId?: ClaimId };

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
  /** Задать вопрос по утверждению или общему разбору */
  | { type: "question.ask"; question: string; claimId?: ClaimId }
  | { type: "cancel" };

export interface ApiError {
  code: "VIDEO_UNAVAILABLE" | "UNSUPPORTED_PLATFORM" | "TRANSCRIPTION_FAILED" | "RATE_LIMITED" | "INTERNAL";
  message: string;
}
