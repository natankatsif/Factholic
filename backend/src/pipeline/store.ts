/**
 * Хранилище задач (jobs) + кэш по видео.
 *
 * Что умеет:
 *  - держит для каждой задачи актуальный VideoReport — его отдаёт GET /api/jobs/:id;
 *  - помнит историю событий: клиент, подключившийся позже (второй зритель, перезагрузка страницы),
 *    сначала получает всё, что уже было, потом — новые события вживую;
 *  - кэш по видео: одно видео не обрабатываем дважды (каждый прогон стоит денег на OpenAI/Tavily);
 *  - сохраняет готовые отчёты на диск — переживают перезапуск сервера.
 *
 * Хранится в памяти процесса: для хакатона хватает. Для продакшена — Redis/Postgres.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JobId, ServerEvent, StartAnalysisRequest, VideoReport } from "@news/contracts";

export interface JobRecord {
  id: JobId;
  request: StartAnalysisRequest;
  /** Ключ кэша: одно и то же видео → один ключ */
  videoKey: string;
  report: VideoReport;
  /** Все события задачи по порядку — для клиентов, подключившихся позже */
  history: ServerEvent[];
  subscribers: Set<(event: ServerEvent) => void>;
  /** Отмена пайплайна (все ушли со страницы) */
  abort: AbortController;
  /** Пайплайн уже запущен (запускаем при первом подключении по WS) */
  started: boolean;
}

const REPORTS_DIR = join(tmpdir(), "factcheck-reports");

export class JobStore {
  private jobs = new Map<JobId, JobRecord>();
  /** videoKey → jobId последней не упавшей задачи по этому видео */
  private byVideo = new Map<string, JobId>();

  constructor() {
    this.loadFromDisk();
  }

  /**
   * Новая заявка. Если это видео уже проверено (или проверяется прямо сейчас) с той же или более ранней
   * секунды — возвращаем существующую задачу, ничего не запускаем повторно.
   */
  create(id: JobId, request: StartAnalysisRequest): { job: JobRecord; cached: boolean } {
    const videoKey = videoKeyOf(request);
    const existing = this.get(this.byVideo.get(videoKey) ?? "");
    if (existing && existing.report.status !== "failed" && existing.request.startFrom <= request.startFrom) {
      return { job: existing, cached: existing.report.status === "completed" };
    }

    const ref = request.video;
    const job: JobRecord = {
      id,
      request,
      videoKey,
      report: {
        jobId: id,
        // заглушка до job.started — настоящие данные пришлёт этап 01
        video: {
          pageUrl: ref.pageUrl,
          platform: ref.platform,
          platformVideoId: ref.platformVideoId,
          title: ref.title ?? "",
          durationSec: ref.durationSec ?? 0,
          language: request.languageHint ?? "und",
        },
        status: "queued",
        processedUntil: request.startFrom,
        factChecks: [],
      },
      history: [],
      subscribers: new Set(),
      abort: new AbortController(),
      started: false,
    };
    this.jobs.set(id, job);
    this.byVideo.set(videoKey, id);
    return { job, cached: false };
  }

  get(id: JobId): JobRecord | undefined {
    return this.jobs.get(id);
  }

  /** Событие от пайплайна: обновить отчёт, записать в историю, разослать всем подключённым */
  emit(job: JobRecord, event: ServerEvent): void {
    applyEvent(job.report, event);
    job.history.push(event);
    for (const send of job.subscribers) send(event);
    if (event.type === "job.completed") this.saveToDisk(job);
    if (event.type === "job.failed") this.forget(job);
  }

  /** Подписка клиента: сначала вся история, потом новые события. Возвращает функцию отписки. */
  subscribe(job: JobRecord, send: (event: ServerEvent) => void): () => void {
    for (const event of job.history) send(event);
    job.subscribers.add(send);
    return () => job.subscribers.delete(send);
  }

  /** Задача ещё идёт? (тогда при уходе всех зрителей её можно отменить) */
  isRunning(job: JobRecord): boolean {
    return job.report.status === "queued" || job.report.status === "processing";
  }

  /** Отменили (все ушли) — помечаем failed и убираем из кэша, чтобы следующая заявка начала заново */
  cancel(job: JobRecord): void {
    job.abort.abort();
    job.report.status = "failed";
    this.forget(job);
  }

  private forget(job: JobRecord): void {
    if (this.byVideo.get(job.videoKey) === job.id) this.byVideo.delete(job.videoKey);
  }

  // ---------- диск: только готовые отчёты ----------

  private saveToDisk(job: JobRecord): void {
    try {
      mkdirSync(REPORTS_DIR, { recursive: true });
      const data = { request: job.request, report: job.report };
      writeFileSync(join(REPORTS_DIR, `${job.id}.json`), JSON.stringify(data));
    } catch (err) {
      console.error("store: не удалось сохранить отчёт", err);
    }
  }

  private loadFromDisk(): void {
    if (!existsSync(REPORTS_DIR)) return;
    for (const file of readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json"))) {
      try {
        const { request, report } = JSON.parse(readFileSync(join(REPORTS_DIR, file), "utf8")) as {
          request: StartAnalysisRequest;
          report: VideoReport;
        };
        const job: JobRecord = {
          id: report.jobId,
          request,
          videoKey: videoKeyOf(request),
          report,
          history: eventsFromReport(report),
          subscribers: new Set(),
          abort: new AbortController(),
          started: true,
        };
        this.jobs.set(job.id, job);
        this.byVideo.set(job.videoKey, job.id);
      } catch {
        // битый файл — пропускаем
      }
    }
  }
}

/** Текст — по хешу содержимого; YouTube: по id видео (ссылки ?v=…&t=… и youtu.be/… дают один ключ); остальное — по URL страницы */
export function videoKeyOf(request: StartAnalysisRequest): string {
  // вставленный текст: ключ по содержимому (у всех текстов может быть одинаковый pageUrl-заглушка)
  if (request.text?.trim()) return `text:${createHash("sha256").update(request.text.trim()).digest("hex")}`;
  const { platform, platformVideoId, pageUrl } = request.video;
  return platformVideoId ? `${platform}:${platformVideoId}` : `url:${pageUrl}`;
}

/** Обновляет снапшот отчёта по событию — так GET /api/jobs/:id всегда актуален */
function applyEvent(report: VideoReport, event: ServerEvent): void {
  switch (event.type) {
    case "job.started":
      report.video = event.video;
      report.status = "processing";
      break;
    case "job.progress":
      report.processedUntil = Math.max(report.processedUntil, event.processedUntil);
      break;
    case "claim.detected":
    case "claim.checked": {
      // тот же id → заменяем ("Проверяем…" → оценка), новый → добавляем; держим порядок по таймкоду
      const list = report.factChecks.filter((f) => f.id !== event.factCheck.id);
      list.push(event.factCheck);
      report.factChecks = list.sort((a, b) => a.range.start - b.range.start);
      break;
    }
    case "job.completed":
      Object.assign(report, event.report, { status: "completed" });
      break;
    case "job.failed":
      report.status = "failed";
      break;
  }
}

/** Отчёт с диска → события, как будто задача только что прошла (для клиентов после перезапуска сервера) */
function eventsFromReport(report: VideoReport): ServerEvent[] {
  return [
    { type: "job.started", jobId: report.jobId, video: report.video },
    ...report.factChecks.map((factCheck) => ({
      type: "claim.checked" as const,
      jobId: report.jobId,
      factCheck,
    })),
    { type: "job.completed", jobId: report.jobId, report },
  ];
}
