/**
 * HTTP + WebSocket сервер.
 * Режим и mock/real по этапам — в корневом .env (шаблон .env.example), читается в config.ts.
 *   npm run dev       — как в .env (по умолчанию SERVER_MODE=pipeline, все этапы mock)
 *   npm run dev:mock  — SERVER_MODE=replay: проигрывает MOCK_EVENTS из @news/contracts (для фронта)
 */
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
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
import { runPipeline } from "./pipeline/orchestrator.ts";

const errors = configErrors();
if (errors.length) {
  console.error("Ошибка конфигурации (.env):\n  " + errors.join("\n  "));
  process.exit(1);
}

const PORT = config.port;
const REPLAY = config.serverMode === "replay";

interface Job {
  request: StartAnalysisRequest;
  started: boolean;
}
const jobs = new Map<JobId, Job>();

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.end();

  if (req.method === "POST" && req.url === API_ROUTES.startJob) {
    const request = JSON.parse(await readBody(req)) as StartAnalysisRequest;
    const jobId = randomUUID();
    jobs.set(jobId, { request, started: false });
    const body: StartAnalysisResponse = {
      jobId,
      eventsUrl: `ws://localhost:${PORT}${API_ROUTES.events(jobId)}`,
      cached: false,
    };
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify(body));
  }

  const getMatch = req.method === "GET" && req.url?.match(/^\/api\/jobs\/([^/]+)$/);
  if (getMatch && REPLAY) {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ ...MOCK_VIDEO_REPORT, jobId: getMatch[1] }));
  }
  // TODO(backend-1): GET /api/jobs/:id для реального режима (хранилище результатов)

  res.statusCode = 404;
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const jobId = req.url?.match(/^\/api\/jobs\/([^/]+)\/events$/)?.[1];
  const job = jobId && jobs.get(jobId);
  if (!jobId || !job || job.started) return socket.destroy();
  job.started = true;
  wss.handleUpgrade(req, socket, head, (ws) => handleJobSocket(ws, jobId, job));
});

function handleJobSocket(ws: WebSocket, jobId: JobId, job: Job) {
  const abort = new AbortController();
  const emit = (e: ServerEvent) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(e));

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString()) as ClientMessage;
    if (msg.type === "cancel") abort.abort();
    // TODO(backend-1): "playback" → приоритизация/перезапуск ingest; "audio.chunk" → liveAudio
  });
  ws.on("close", () => abort.abort());

  if (REPLAY) {
    const timers = MOCK_EVENTS.map(({ atMs, event }) =>
      setTimeout(() => emit({ ...event, jobId } as ServerEvent), atMs),
    );
    abort.signal.addEventListener("abort", () => timers.forEach(clearTimeout));
    return;
  }

  runPipeline({ jobId, request: job.request, emit, signal: abort.signal }).catch((err) => {
    console.error(err);
    emit({ type: "job.failed", jobId, error: { code: "INTERNAL", message: String(err) } });
  });
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
