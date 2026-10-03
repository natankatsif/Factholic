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
import { config, configErrors, describeConfig } from "./config.ts";
import { PipelineError } from "./pipeline/context.ts";
import { runPipeline } from "./pipeline/orchestrator.ts";
import { JobStore, type JobRecord } from "./pipeline/store.ts";

const errors = configErrors();
if (errors.length) {
  console.error("Ошибка конфигурации (.env):\n  " + errors.join("\n  "));
  process.exit(1);
}

const PORT = config.port;
const REPLAY = config.serverMode === "replay";

/** Задачи, кэш по видео, готовые отчёты (см. pipeline/store.ts) */
const store = new JobStore();

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.end();

  if (req.method === "POST" && req.url === API_ROUTES.startJob) {
    let request: StartAnalysisRequest;
    try {
      request = JSON.parse(await readBody(req)) as StartAnalysisRequest;
      if (!request?.video?.pageUrl) throw new Error("нет video.pageUrl");
    } catch (err) {
      return sendJson(res, 400, { error: `неверный запрос: ${(err as Error).message}` });
    }
    // Видео уже проверено или проверяется → вернётся существующая задача (cached: true — уже готово)
    const { job, cached } = store.create(randomUUID(), request);
    const body: StartAnalysisResponse = { jobId: job.id, eventsUrl: eventsUrlFor(req, job.id), cached };
    return sendJson(res, 200, body);
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
  const jobId = req.url?.match(/^\/api\/jobs\/([^/]+)\/events$/)?.[1];
  const job = jobId ? store.get(jobId) : undefined;
  if (!job) return socket.destroy();
  // К одной задаче можно подключиться несколько раз (второй зритель, перезагрузка страницы)
  wss.handleUpgrade(req, socket, head, (ws) =>
    REPLAY ? replaySocket(ws, job.id) : handleJobSocket(ws, job),
  );
});

function handleJobSocket(ws: WebSocket, job: JobRecord) {
  const send = (e: ServerEvent) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(e));
  // Сначала придёт всё, что уже было (для готового видео — сразу весь отчёт), потом новые события
  const unsubscribe = store.subscribe(job, send);

  const leave = () => {
    unsubscribe();
    // Все ушли, а проверка не закончена — останавливаем, чтобы не тратить деньги на API впустую
    if (job.subscribers.size === 0 && store.isRunning(job)) store.cancel(job);
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
    // TODO(backend-1): "playback" → приоритизация/перезапуск ingest; "audio.chunk" → liveAudio
  });

  // Пайплайн запускается один раз — при первом подключении
  if (job.started) return;
  job.started = true;
  const emit = (e: ServerEvent) => store.emit(job, e);
  runPipeline({ jobId: job.id, request: job.request, emit, signal: job.abort.signal }).catch((err) => {
    if (job.abort.signal.aborted) return; // отменили сами — это не ошибка
    // В лог — всё, включая техническую причину (cause); фронту — код и понятный текст
    console.error(`[${job.id}] job.failed:`, err);
    const error =
      err instanceof PipelineError
        ? { code: err.code, message: err.message }
        : { code: "INTERNAL" as const, message: "Что-то пошло не так на сервере, попробуй ещё раз" };
    emit({ type: "job.failed", jobId: job.id, error });
  });
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

server.listen(PORT, () => console.log(`backend on :${PORT}\n${describeConfig()}`));
