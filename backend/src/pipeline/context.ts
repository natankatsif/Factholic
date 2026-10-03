import type { JobId } from "@news/contracts";

/** Передаётся вторым аргументом в каждый этап. */
export interface StageContext {
  jobId: JobId;
  /** Срабатывает, когда пользователь закрыл вкладку / отменил — прерывай запросы к API */
  signal: AbortSignal;
  log: (msg: string, data?: unknown) => void;
}

/** Сигнатура любого этапа: чистая функция вход -> выход. */
export type Stage<I, O> = (input: I, ctx: StageContext) => Promise<O>;
