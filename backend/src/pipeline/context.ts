import type { ApiError, JobId } from "@news/contracts";

/**
 * Ошибка с кодом для фронта. Этапы бросают её, когда знают причину:
 *   throw new PipelineError("VIDEO_UNAVAILABLE", "Видео недоступно или удалено", { cause: err });
 * message — понятный человеку текст (его увидит пользователь). Технические детали — в cause, только в лог.
 * Любая другая ошибка уходит фронту как INTERNAL.
 */
export class PipelineError extends Error {
  constructor(
    readonly code: ApiError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PipelineError";
  }
}

/** Токены одного вызова модели: считаем цену проверки */
export interface LlmUsage {
  stage: string;
  model: string;
  input: number;
  cached: number;
  output: number;
}

/** Что поиск делает прямо сейчас: кабинет показывает это как ход проверки */
export type SearchActivity =
  /** Начался новый поиск: первый, «Найти ещё» или повторный */
  | { kind: "start" }
  | { kind: "queries"; texts: string[] }
  | { kind: "anchors"; terms: string[] }
  | { kind: "filtered"; checked: number; kept: number; sites: string[] }
  | { kind: "tree"; publications: number; links: number };

/** Передаётся вторым аргументом в каждый этап. */
export interface StageContext {
  jobId: JobId;
  /** Срабатывает, когда пользователь закрыл вкладку / отменил — прерывай запросы к API */
  signal: AbortSignal;
  log: (msg: string, data?: unknown) => void;
  /** Учёт токенов: задаёт тот, кому нужна цена, например eval */
  usage?: (usage: LlmUsage) => void;
  /** Ход поиска для показа: задаёт сервер */
  activity?: (activity: SearchActivity) => void;
}

/** Сигнатура любого этапа: чистая функция вход -> выход. */
export type Stage<I, O> = (input: I, ctx: StageContext) => Promise<O>;
