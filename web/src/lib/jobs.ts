/**
 * Проверки (jobs): создать, получить по id, список для истории, реалтайм-подписка.
 * Каждая проверка живёт на своей странице /check/<jobId>.
 *
 * Источник данных — WEB_DATA_SOURCE в корневом .env (см. next.config.mjs):
 *   mock    — отчёт из MOCK_VIDEO_REPORT, проверки хранятся в localStorage браузера (по умолчанию)
 *   backend — POST/GET /api/jobs и WebSocket /api/jobs/:id/events на WEB_BACKEND_URL
 */
import {
  API_ROUTES,
  type ClaimId,
  type ClientMessage,
  type JobId,
  type ServerEvent,
  type StartAnalysisRequest,
  type StartAnalysisResponse,
  type VideoReport,
} from "@news/contracts";
import { MOCK_VIDEO_REPORT } from "@news/contracts/mocks";
import { reportYoutubeId, youtubeVideoId } from "./youtube";

// выше BACKEND_URL: resolveBackendUrl читает её при загрузке модуля
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "backend" ? "backend" : "mock";
export const BACKEND_URL = resolveBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787");

/**
 * Бэкенд настроен на localhost, а сайт открыт с другого устройства (телефон по Wi-Fi на http://192.168.…:3000
 * или через туннель Cloudflare по https): для телефона localhost — он сам, а порт бэкенда снаружи закрыт.
 * Тогда идём на тот же адрес, что и сайт: Next пересылает /api/* на бэкенд (rewrites в next.config.mjs).
 */
function resolveBackendUrl(configured: string): string {
  if (typeof window === "undefined") return configured;
  try {
    const url = new URL(configured);
    const page = window.location.hostname;
    if (!LOCAL_HOSTS.has(url.hostname) || !page || LOCAL_HOSTS.has(page)) return configured;
    return window.location.origin;
  } catch {
    return configured;
  }
}

const STORAGE_KEY = "factholic:jobs";
const MAX_STORED = 50;

/** Запись в истории: что спросили и когда */
export interface JobRecord {
  jobId: JobId;
  input: string;
  isUrl: boolean;
  createdAt: string;
  report?: VideoReport;
}

export async function createJob(input: string, isUrl: boolean): Promise<JobId> {
  const record: JobRecord = { jobId: "", input, isUrl, createdAt: new Date().toISOString() };

  if (DATA_SOURCE === "backend") {
    const res = await fetch(`${BACKEND_URL}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toRequest(input, isUrl)),
    });
    if (!res.ok) throw new Error(`Не удалось начать проверку: HTTP ${res.status}`);
    const data = (await res.json()) as StartAnalysisResponse;
    record.jobId = data.jobId;
  } else {
    record.jobId = `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    // ссылка на YouTube — моковые утверждения поверх настоящего видео, чтобы работал плеер
    const ytId = isUrl ? youtubeVideoId(input) : null;
    record.report = {
      ...MOCK_VIDEO_REPORT,
      jobId: record.jobId,
      video: ytId
        ? { ...MOCK_VIDEO_REPORT.video, pageUrl: input, platform: "youtube", platformVideoId: ytId }
        : { ...MOCK_VIDEO_REPORT.video, title: input.slice(0, 120) },
    };
  }

  save([record, ...listJobs().filter((j) => j.jobId !== record.jobId)].slice(0, MAX_STORED));
  return record.jobId;
}

/** Отчёт по проверке (однократный GET). null — такой проверки нет. */
export async function getReport(jobId: JobId): Promise<VideoReport | null> {
  if (DATA_SOURCE === "backend") {
    const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Не удалось загрузить проверку: HTTP ${res.status}`);
    return (await res.json()) as VideoReport;
  }
  return listJobs().find((j) => j.jobId === jobId)?.report ?? null;
}

/** Проверить найденное утверждение сейчас — по HTTP, когда WS нет (отчёт открыт из истории) */
export async function requestClaimCheck(jobId: JobId, claimId: ClaimId): Promise<void> {
  if (DATA_SOURCE !== "backend") return;
  await fetch(
    `${BACKEND_URL}${API_ROUTES.checkClaim(encodeURIComponent(jobId), encodeURIComponent(claimId))}`,
    {
      method: "POST",
    },
  ).catch(() => {});
}

export interface JobSubscription {
  unsubscribe: () => void;
  /**
   * Сообщение бэкенду: позиция плеера ("playback") и «проверь это утверждение» ("claim.check").
   * WS ещё не открылся — отправится при подключении (от playback — только последнее); WS нет — claim.check по HTTP
   */
  send: (msg: ClientMessage) => void;
}

/**
 * Подписка на ход проверки: в реальном режиме подключается по WebSocket к бэкенду
 * (запуская пайплайн при первом подключении и получая стрим событий),
 * с fallback на опрос по HTTP при сбоях сети.
 * WS остаётся открытым и после job.completed: утверждения проверяются по ходу просмотра.
 */
export function subscribeJob(
  jobId: JobId,
  onUpdate: (report: VideoReport, event?: ServerEvent) => void,
  onError: (err: Error) => void,
): JobSubscription {
  if (DATA_SOURCE === "mock") {
    const report = listJobs().find((j) => j.jobId === jobId)?.report ?? {
      ...MOCK_VIDEO_REPORT,
      jobId,
    };
    onUpdate(report);
    return { unsubscribe: () => {}, send: () => {} };
  }

  let cancelled = false;
  let ws: WebSocket | null = null;
  let pollTimer: NodeJS.Timeout | null = null;
  let currentReport: VideoReport | null = null;
  /** Сообщения до открытия WS: последняя позиция плеера и запросы проверки */
  let pendingPlayback: ClientMessage | null = null;
  const pendingChecks: ClientMessage[] = [];

  const send = (msg: ClientMessage) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    if (msg.type === "playback") pendingPlayback = msg;
    else if (msg.type === "claim.check") {
      // WS нет и не будет (закрылся, опрос по HTTP) — по HTTP; ещё подключается — дождёмся
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)
        void requestClaimCheck(jobId, msg.claimId);
      else pendingChecks.push(msg);
    }
  };

  // 1. Сначала пробуем получить существующий снапшот из бэкенда
  getReport(jobId)
    .then((report) => {
      if (cancelled) return;
      if (report) {
        currentReport = report;
        onUpdate(report);
        if (report.status === "failed") return;
        if (report.status === "completed") updateJobRecord(jobId, report);
      }
      // и для готового отчёта: утверждения проверяются по требованию, результаты приходят событиями
      connectWs();
    })
    .catch(() => {
      if (!cancelled) connectWs();
    });

  function connectWs() {
    if (cancelled) return;
    try {
      const wsUrl =
        BACKEND_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:") +
        `/api/jobs/${encodeURIComponent(jobId)}/events`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        for (const msg of [...pendingChecks.splice(0), ...(pendingPlayback ? [pendingPlayback] : [])])
          ws?.send(JSON.stringify(msg));
        pendingPlayback = null;
      };

      ws.onmessage = (e) => {
        if (cancelled) return;
        try {
          const event = JSON.parse(e.data as string) as ServerEvent;
          console.debug(`[job ${jobId}]`, event.type, "stage" in event ? event.stage : "", event);
          if (event.type === "job.failed") {
            onError(new Error(event.error.message || "Ошибка при проверке"));
            return;
          }
          currentReport = applyEventToReport(currentReport, event, jobId);
          onUpdate(currentReport, event);

          // в истории браузера — и проверки по требованию после завершения разбора
          if (
            event.type === "job.completed" ||
            (event.type === "claim.checked" && currentReport.status === "completed")
          ) {
            updateJobRecord(jobId, currentReport);
          }
        } catch (err) {
          console.error("subscribeJob: ошибка разбора события", err);
        }
      };

      ws.onerror = () => {
        if (!cancelled && !pollTimer) startPolling();
      };

      ws.onclose = () => {
        if (!cancelled && currentReport?.status !== "completed" && currentReport?.status !== "failed") {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }
  }

  function startPolling() {
    if (pollTimer || cancelled) return;
    pollTimer = setInterval(async () => {
      if (cancelled) return;
      try {
        const report = await getReport(jobId);
        if (report && !cancelled) {
          currentReport = report;
          onUpdate(report);
          if (report.status === "completed" || report.status === "failed") {
            updateJobRecord(jobId, report);
            if (pollTimer) clearInterval(pollTimer);
          }
        }
      } catch {
        // продолжаем опрос
      }
    }, 2000);
  }

  return {
    send,
    unsubscribe: () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    },
  };
}

function applyEventToReport(existing: VideoReport | null, event: ServerEvent, jobId: JobId): VideoReport {
  const report: VideoReport = existing
    ? { ...existing, factChecks: [...existing.factChecks] }
    : {
        jobId,
        video: {
          pageUrl: "",
          platform: "generic",
          title: "",
          durationSec: 0,
          language: "und",
        },
        status: "processing",
        processedUntil: 0,
        factChecks: [],
      };

  switch (event.type) {
    case "job.started":
      report.video = event.video;
      report.status = "processing";
      break;
    case "job.progress":
      report.processedUntil = Math.max(report.processedUntil, event.processedUntil);
      report.stage = event.stage;
      break;
    case "claim.progress":
      report.factChecks = report.factChecks.map((f) =>
        f.id === event.claimId && f.status === "checking"
          ? { ...f, stage: event.stage, sourcesFound: event.sourcesFound ?? f.sourcesFound }
          : f,
      );
      break;
    case "claim.detected":
    case "claim.checked": {
      // sourcesFound пришёл в claim.progress — не теряем его, когда приходит готовый тезис
      const prev = report.factChecks.find((f) => f.id === event.factCheck.id);
      const list = report.factChecks.filter((f) => f.id !== event.factCheck.id);
      list.push({ ...event.factCheck, sourcesFound: event.factCheck.sourcesFound ?? prev?.sourcesFound });
      report.factChecks = list.sort((a, b) => a.range.start - b.range.start);
      break;
    }
    case "job.completed":
      return { ...event.report, status: "completed" };
    case "job.failed":
      report.status = "failed";
      break;
  }

  return report;
}

export function updateJobRecord(jobId: JobId, report: VideoReport) {
  if (typeof window === "undefined") return;
  const jobs = listJobs();
  const index = jobs.findIndex((j) => j.jobId === jobId);
  if (index !== -1) {
    const prev = jobs[index]!;
    jobs[index] = {
      ...prev,
      // для текста input — полный исходный текст; заголовок (первая фраза) его не заменяет
      report: prev.isUrl ? report : { ...report, sourceText: report.sourceText ?? prev.input },
      input: prev.isUrl ? report.video?.title || prev.input : prev.input,
    };
    save(jobs);
  } else {
    const isUrl = Boolean(report.video?.pageUrl && !report.video.pageUrl.startsWith("text:"));
    const newRecord: JobRecord = {
      jobId,
      input: report.video?.title || report.video?.pageUrl || jobId,
      isUrl,
      createdAt: new Date().toISOString(),
      report,
    };
    save([newRecord, ...jobs].slice(0, MAX_STORED));
  }
}

/**
 * Готовая проверка того же материала из истории этого браузера — чтобы не запускать её заново.
 * Видео YouTube — по id (watch?v=…, youtu.be/…, shorts/… — одно видео), другие ссылки — по адресу без
 * протокола, www и якоря; текст — по самому тексту. У ссылок input после проверки — уже название видео,
 * поэтому сравниваем с адресом из отчёта.
 */
export function findCompletedJob(input: string, isUrl: boolean): JobRecord | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ytId = isUrl ? youtubeVideoId(trimmed) : null;
  const url = isUrl ? normalizeUrl(trimmed) : "";
  return (
    listJobs().find((job) => {
      const report = job.report;
      if (report?.status !== "completed" || !report.factChecks.length || job.isUrl !== isUrl) return false;
      if (!isUrl) return (report.sourceText ?? job.input).trim() === trimmed;
      if (ytId) return reportYoutubeId(report.video) === ytId;
      return normalizeUrl(report.video.pageUrl) === url;
    }) ?? null
  );
}

/** Открыли проверку заново — поднимаем её наверх истории */
export function bumpJob(jobId: JobId): void {
  if (typeof window === "undefined") return;
  const jobs = listJobs();
  const job = jobs.find((j) => j.jobId === jobId);
  if (!job) return;
  save([{ ...job, createdAt: new Date().toISOString() }, ...jobs.filter((j) => j.jobId !== jobId)]);
}

function normalizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www|m)\./i, "")
    .replace(/#.*$/, "")
    .replace(/\/+(\?|$)/, "$1")
    .toLowerCase();
}

export function deleteJob(jobId: JobId): void {
  if (typeof window === "undefined") return;
  const jobs = listJobs().filter((j) => j.jobId !== jobId);
  save(jobs);
}

export function clearJobs(): void {
  if (typeof window === "undefined") return;
  save([]);
}

/** Все проверки этого браузера, новые сверху — для страницы «История» */
export function listJobs(): JobRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as JobRecord[];
  } catch {
    return [];
  }
}

function save(jobs: JobRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function toRequest(input: string, isUrl: boolean): StartAnalysisRequest {
  const ytId = isUrl ? youtubeVideoId(input) : null;
  return isUrl
    ? {
        video: ytId
          ? { pageUrl: input, platform: "youtube", platformVideoId: ytId }
          : { pageUrl: input, platform: "generic" },
        mode: "remote",
        startFrom: 0,
        uiLanguage: "ru",
      }
    : {
        video: { pageUrl: "text:pasted", platform: "generic" },
        mode: "remote",
        startFrom: 0,
        uiLanguage: "ru",
        text: input,
      };
}
