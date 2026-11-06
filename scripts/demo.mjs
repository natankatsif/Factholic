#!/usr/bin/env node
/**
 * Демо кабинета одной командой: SearXNG, бэкенд на настоящем поиске и сайт.
 * Проверки платные: каждая тратит запросы Tavily и LLM. Остановка: Ctrl+C.
 */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_PORT = process.env.DEMO_WEB_PORT ?? "3000";
const API_PORT = "8787";
const SEARXNG_PORT = "8899";

const BACKEND_ENV = {
  PORT: API_PORT,
  CABINET_API: "on",
  CABINET_DB_PATH: "tmp/cabinet-real.sqlite",
  CABINET_ORG_NAME: "Центр коммуникаций",
  CABINET_MEMBER_NAME: "Ирина К.",
  TRACE_SEARCH: "on",
  DEEP_SEARCH: "on",
  SEARXNG_URL: `http://127.0.0.1:${SEARXNG_PORT}`,
  MAX_CLAIMS_PER_CHUNK: "1",
  MAX_CLAIMS_PER_JOB: "1",
  // видео проверяется за плеером: начало и две минуты вперёд, одной проверки на ролик мало
  MAX_CLAIMS_PER_VIDEO: "20",
  STAGE_INGEST: "real",
  STAGE_TRANSCRIPTION: "real",
  STAGE_CLAIM_EXTRACTION: "real",
  STAGE_SOURCE_SEARCH: "real",
  STAGE_PROVENANCE: "real",
  STAGE_MUTATIONS: "real",
  STAGE_STANCES: "real",
};

function portBusy(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: Number(port) });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

const busy = [];
for (const port of [WEB_PORT, API_PORT, SEARXNG_PORT]) if (await portBusy(port)) busy.push(port);
if (busy.length) {
  console.error(`Порты заняты: ${busy.join(", ")}. Остановите то, что на них запущено, и повторите.`);
  process.exit(1);
}

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}

function start(name, command, args, env = {}, { required = true } = {}) {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "inherit" });
  children.push(child);
  child.once("exit", (code) => {
    if (stopping) return;
    if (required) {
      console.error(`${name} остановился, код ${code}. Выключаю демо.`);
      stop(code ?? 1);
    } else {
      console.error(`${name} остановился: демо работает без него, только через Tavily.`);
    }
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

start("SearXNG", "sh", ["scripts/searxng.sh"], {}, { required: false });
start("Бэкенд", "npm", ["run", "dev", "-w", "@news/backend"], BACKEND_ENV);
start("Сайт", "npm", ["run", "dev", "-w", "web", "--", "-p", WEB_PORT], {
  WEB_DATA_SOURCE: "backend",
  WEB_BACKEND_URL: `http://localhost:${API_PORT}`,
});

console.log(`\nКабинет: http://localhost:${WEB_PORT}/cabinet\nОстановка: Ctrl+C\n`);
