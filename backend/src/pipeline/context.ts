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

/** Передаётся вторым аргументом в каждый этап. */
export interface StageContext {
  jobId: JobId;
  /** Срабатывает, когда пользователь закрыл вкладку / отменил — прерывай запросы к API */
  signal: AbortSignal;
  log: (msg: string, data?: unknown) => void;
}

/** Сигнатура любого этапа: чистая функция вход -> выход. */
export type Stage<I, O> = (input: I, ctx: StageContext) => Promise<O>;
