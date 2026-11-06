/**
 * HTTP + WebSocket сервер.
 * Режим и mock/real по этапам — в корневом .env (шаблон .env.example), читается в config.ts.
 *   npm run dev       — как в .env (по умолчанию SERVER_MODE=pipeline, все этапы mock)
 *   npm run dev:mock  — SERVER_MODE=replay: проигрывает MOCK_EVENTS из @news/contracts (для фронта)
 */
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  API_ROUTES,
  type ClientMessage,
  type JobId,
  type ServerEvent,
  type StartAnalysisRequest,
  type StartAnalysisResponse,
} from "@news/contracts";
import { MOCK_EVENTS, MOCK_VIDEO_REPORT } from "@news/contracts/mocks";
import { chatConfigErrors, handleChat, type ChatRequestBody } from "./chat/index.ts";
import { config, configErrors, describeConfig } from "./config.ts";
import { messagesFor, pipelineErrorText } from "./messages.ts";
import { ClaimChecker } from "./pipeline/checks.ts";
import type { SearchActivity } from "./pipeline/context.ts";
import { failedPageView, forgetPage, loadPageView } from "./pipeline/page-view.ts";
import { reportLabels } from "./pipeline/report-labels.ts";
import { PipelineError } from "./pipeline/context.ts";
import { allow, clientIp } from "./pipeline/guard.ts";
import { runPipeline } from "./pipeline/orchestrator.ts";
import { JobStore, type JobRecord } from "./pipeline/store.ts";
import { createOrgApi } from "./org/routes.ts";

process.on("unhandledRejection", (reason) => {
  console.error("server: unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("server: uncaughtException:", err);
});

const errors = configErrors();
if (errors.length) {
  console.error("Ошибка конфигурации (.env):\n  " + errors.join("\n  "));
  process.exit(1);
}

const PORT = config.port;
const REPLAY = config.serverMode === "replay";

/** Задачи, кэш по видео, готовые отчёты (см. pipeline/store.ts) */
const store = new JobStore();

/** Кабинет организаций: только с CABINET_API=on, входа в аккаунт пока нет */
const orgApi = config.cabinet.api
  ? createOrgApi({
      start: (request, fresh) => {
        const { job } = store.create(randomUUID(), request, undefined, fresh);
        // кабинет ведёт проверку сам: ушли со страницы — разбор всё равно должен дойти до конца
        job.keepRunning = true;
        startJob(job);
        return job.id;
      },
      report: (jobId) => store.get(jobId)?.report,
      activity: (jobId) => store.get(jobId)?.activity ?? [],
      forget: (jobId, keepJob) => {
        const job = store.get(jobId);
        if (!job) return;
        forgetPage(job.report.video.pageUrl);
        store.purge(job, keepJob);
      },
      more: (jobId, claimId) => {
        const job = store.get(jobId);
        return (job && ensureChecker(job)?.more(claimId)) ?? false;
      },
      subscribe: (jobId, listener) => {
        const job = store.get(jobId);
        return job ? store.subscribe(job, listener) : () => undefined;
      },
    })
  : undefined;

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.end();

  if (orgApi && (await orgApi.handle(req, res))) return;

  if (req.method === "POST" && req.url === API_ROUTES.startJob) {
    let request: StartAnalysisRequest;
    try {
      request = JSON.parse(await readBody(req, MAX_JOB_BODY)) as StartAnalysisRequest;
      if (!request?.video?.pageUrl) throw new Error("нет video.pageUrl");
    } catch (err) {
      if (err instanceof BodyTooLarge)
        return sendJson(res, 413, { error: messagesFor(languageOf(req)).fileTooLarge });
      return sendJson(res, 400, { error: `неверный запрос: ${(err as Error).message}` });
    }
    if (request.text && request.text.length > config.limits.maxTextChars) {
      return sendJson(res, 413, {
        error: messagesFor(request.uiLanguage).textTooLong(config.limits.maxTextChars),
      });
    }
    // Готовое или идущее из кэша — бесплатно; новый материал — в лимит человека и дневной бюджет
    const ip = clientIp(req);
    const denied = REPLAY || store.reusable(request) ? null : allow("job", ip, request.uiLanguage);
    if (denied) return sendJson(res, 429, { error: denied, code: "RATE_LIMITED" });
    // Видео уже проверено или проверяется → вернётся существующая задача (cached: true — уже готово)
    const { job, cached } = store.create(randomUUID(), request, ip);
    const body: StartAnalysisResponse = { jobId: job.id, eventsUrl: eventsUrlFor(req, job.id), cached };
    return sendJson(res, 200, body);
  }

  const chatMatch = req.method === "POST" && req.url?.match(/^\/api\/jobs\/([^/]+)\/chat$/);
  if (chatMatch) {
    const missing = chatConfigErrors();
    if (missing.length)
      return sendJson(res, 503, { error: `чат не настроен, в .env нужны: ${missing.join("; ")}` });
    const chatJob = REPLAY ? undefined : store.get(chatMatch[1]!);
    const report = REPLAY ? { ...MOCK_VIDEO_REPORT, jobId: chatMatch[1]! } : chatJob?.report;
    const chatLanguage = chatJob?.request.uiLanguage ?? languageOf(req);
    if (!report) return sendJson(res, 404, { error: "задача не найдена" });
    let body: ChatRequestBody;
    try {
      body = JSON.parse(await readBody(req, MAX_CHAT_BODY)) as ChatRequestBody;
      if (!Array.isArray(body?.messages) || !body.messages.length) throw new Error("нет messages");
    } catch (err) {
      if (err instanceof BodyTooLarge)
        return sendJson(res, 413, { error: messagesFor(chatLanguage).chatTooLong });
      return sendJson(res, 400, { error: `неверный запрос: ${(err as Error).message}` });
    }
    const denied = allow("chat", clientIp(req), chatLanguage);
    if (denied) return sendJson(res, 429, { error: denied, code: "RATE_LIMITED" });
    return handleChat(req, res, report, body, chatLanguage).catch((err: unknown) => {
      console.error(`[${report.jobId}] chat: упал`, err);
      if (!res.headersSent) sendJson(res, 500, { error: messagesFor(chatLanguage).chatFailed });
      else res.end();
    });
  }

  // Проверить найденное утверждение сейчас — без WS (отчёт открыт из истории)
  const checkMatch =
    req.method === "POST" && req.url?.match(/^\/api\/jobs\/([^/]+)\/claims\/([^/]+)\/check$/);
  if (checkMatch) {
    if (REPLAY) return sendJson(res, 202, { queued: false });
    const job = store.get(checkMatch[1]!);
    const claimId = decodeURIComponent(checkMatch[2]!);
    const checker = job && ensureChecker(job);
    if (!checker) return sendJson(res, 404, { error: "задача не найдена или её утверждения не сохранены" });
    if (!checker.has(claimId)) return sendJson(res, 404, { error: "утверждение не найдено" });
    return sendJson(res, 202, { queued: checker.request(claimId) });
  }

  // Подписи уже готовых отчётов на выбранном языке
  const labelsMatch = req.method === "GET" && req.url?.match(/^\/api\/report-labels\/(ru|ro|en)$/);
  if (labelsMatch) return sendJson(res, 200, reportLabels(labelsMatch[1]!));

  // Копия статьи для встроенного окна. Только страница своей задачи: это не открытый прокси
  const pageMatch = req.method === "GET" && req.url?.match(/^\/api\/jobs\/([^/]+)\/page$/);
  if (pageMatch) {
    const job = REPLAY ? undefined : store.get(pageMatch[1]!);
    const view = job ? await loadPageView(job.report.video.pageUrl) : failedPageView();
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("content-security-policy", view.csp);
    res.setHeader("x-content-type-options", "nosniff");
    return res.end(view.html);
  }

  // Кнопка «Найти ещё» у готового утверждения: новый поиск дополняет прошлый
  const moreMatch = req.method === "POST" && req.url?.match(/^\/api\/jobs\/([^/]+)\/claims\/([^/]+)\/more$/);
  if (moreMatch) {
    if (REPLAY) return sendJson(res, 202, { queued: false });
    const job = store.get(moreMatch[1]!);
    const checker = job && ensureChecker(job);
    if (!checker) return sendJson(res, 404, { error: "задача не найдена или её утверждения недоступны" });
    return sendJson(res, 202, { queued: checker.more(decodeURIComponent(moreMatch[2]!)) });
  }

  const getMatch = req.method === "GET" && req.url?.match(/^\/api\/jobs\/([^/]+)$/);
  if (getMatch) {
    if (REPLAY) return sendJson(res, 200, { ...MOCK_VIDEO_REPORT, jobId: getMatch[1] });
    // Снапшот отчёта: всё, что уже проверено (для сайта — страница отчёта по ссылке)
    const job = store.get(getMatch[1]!);
    return job ? sendJson(res, 200, job.report) : sendJson(res, 404, { error: "задача не найдена" });
  }

  res.statusCode = 404;
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (orgApi?.isEventsUrl(req.url)) {
    wss.handleUpgrade(req, socket, head, (ws) => orgApi.addListener(ws));
    return;
  }
  const jobId = req.url?.match(/^\/api\/jobs\/([^/]+)\/events$/)?.[1];
  const job = jobId ? store.get(jobId) : undefined;
  if (!job) return socket.destroy();
  // К одной задаче можно подключиться несколько раз (второй зритель, перезагрузка страницы)
  wss.handleUpgrade(req, socket, head, (ws) =>
    REPLAY ? replaySocket(ws, job.id) : handleJobSocket(ws, job),
  );
});

function handleJobSocket(ws: WebSocket, job: JobRecord) {
  if (job.cancelTimer) {
    clearTimeout(job.cancelTimer);
    job.cancelTimer = undefined;
  }
  const send = (e: ServerEvent) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(e));
  // Сначала придёт всё, что уже было (для готового видео — сразу весь отчёт), потом новые события
  const unsubscribe = store.subscribe(job, send);

  const leave = () => {
    unsubscribe();
    // никто не смотрит — новых проверок не начинаем (идущие доводятся до конца)
    if (job.subscribers.size === 0) job.checker?.pause();
    // Даём 30 секунд запаса на случай перезагрузки страницы или переподключения WS
    if (job.subscribers.size === 0 && store.isRunning(job) && !job.keepRunning) {
      if (!job.cancelTimer) {
        job.cancelTimer = setTimeout(() => {
          if (job.subscribers.size === 0 && store.isRunning(job)) {
            store.cancel(job);
          }
          job.cancelTimer = undefined;
        }, 30_000);
      }
    }
  };
  ws.on("close", leave);
  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }
    if (msg.type === "cancel") ws.close();
    // позиция плеера: проверяем текущее утверждение и то, что впереди на две минуты
    if (msg.type === "playback" && Number.isFinite(msg.currentTime))
      ensureChecker(job)?.playhead(msg.currentTime);
    // пользователь открыл утверждение — проверить первым
    if (msg.type === "claim.check") ensureChecker(job)?.request(msg.claimId);
    // TODO(backend-1): "playback" → приоритизация ingest (куски у позиции плеера); "audio.chunk" → liveAudio
  });

  // Пайплайн запускается один раз — при первом подключении
  startJob(job);
}

/** Запустить пайплайн задачи. Кабинет вызывает это сам: его проверки идут без открытого сокета */
function startJob(job: JobRecord) {
  if (job.started) return;
  job.started = true;
  const emit = (e: ServerEvent) => store.emit(job, e);
  runPipeline({
    jobId: job.id,
    request: job.request,
    emit,
    signal: job.abort.signal,
    onChecker: (checker) => (job.checker = checker),
    ownerIp: job.ownerIp,
    onActivity: (activity) => noteActivity(job, activity),
  }).catch((err) => {
    if (job.abort.signal.aborted) return; // отменили сами — это не ошибка
    // В лог — всё, включая техническую причину (cause); фронту — код и понятный текст
    console.error(`[${job.id}] job.failed:`, err);
    const error =
      err instanceof PipelineError
        ? { code: err.code, message: pipelineErrorText(err.code, err.message, job.request.uiLanguage) }
        : {
            code: "INTERNAL" as const,
            message: messagesFor(job.request.uiLanguage).jobFailed.INTERNAL,
          };
    emit({ type: "job.failed", jobId: job.id, error });
  });
}

/**
 * Очередь проверок задачи. Пайплайн создаёт её сам; отчёт с диска (после перезапуска сервера) — восстанавливаем
 * из сохранённых утверждений. Нет данных (старый отчёт, задача ещё не началась) — undefined.
 */
const MAX_ACTIVITY = 200;

function noteActivity(job: JobRecord, activity: SearchActivity): void {
  if (job.activity.length < MAX_ACTIVITY) job.activity.push(activity);
}

function ensureChecker(job: JobRecord): ClaimChecker | undefined {
  if (job.checker || !job.saved || job.report.status !== "completed") return job.checker;
  const ctx = {
    jobId: job.id,
    signal: job.abort.signal,
    log: (msg: string, data?: unknown) => console.log(`[${job.id}] ${msg}`, data ?? ""),
    activity: (activity: SearchActivity) => noteActivity(job, activity),
  };
  const checker = new ClaimChecker({
    jobId: job.id,
    request: job.request,
    video: job.report.video,
    emit: (e) => store.emit(job, e),
    signal: job.abort.signal,
    ctx,
    ownerIp: job.ownerIp,
  });
  checker.restore(job.saved, job.report.factChecks);
  job.checker = checker;
  return checker;
}

/** SERVER_MODE=replay: каждому подключению — свой проигрыш MOCK_EVENTS */
function replaySocket(ws: WebSocket, jobId: JobId) {
  const send = (e: ServerEvent) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(e));
  const timers = MOCK_EVENTS.map(({ atMs, event }) =>
    setTimeout(() => send({ ...event, jobId } as ServerEvent), atMs),
  );
  ws.on("close", () => timers.forEach(clearTimeout));
}

/** ws://host/... для локалки, wss://host/... за HTTPS-прокси при деплое */
function eventsUrlFor(req: IncomingMessage, jobId: JobId): string {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const secure = req.headers["x-forwarded-proto"] === "https";
  return `${secure ? "wss" : "ws"}://${host}${API_ROUTES.events(jobId)}`;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** Заявка с картинкой (data URL) — до 8 МБ; чат — вся переписка, до 300 КБ */
const MAX_JOB_BODY = 8 * 1024 * 1024;
const MAX_CHAT_BODY = 300 * 1024;

class BodyTooLarge extends Error {}

/** Тело запроса ещё не прочитано или язык в нём не указан: берём первый язык браузера */
function languageOf(req: IncomingMessage): string {
  return req.headers["accept-language"]?.slice(0, 2).toLowerCase() || "ru";
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      // остаток дочитываем вхолостую: ответ 413 должен дойти до клиента
      if (size > maxBytes) return reject(new BodyTooLarge());
      data += c;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

server.listen(PORT, () => console.log(`backend on :${PORT}\n${describeConfig()}`));
