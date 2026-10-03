/**
 * Тестовый клиент вместо расширения: POST /api/jobs → WebSocket → печать событий.
 * Сервер должен быть запущен (npm run dev или npm run dev:mock) в соседнем терминале.
 *
 *   npx tsx backend/src/pipeline/dev-client.ts "<ссылка>" [с какой секунды] [язык UI]
 *
 * Пример:
 *   npx tsx backend/src/pipeline/dev-client.ts "https://www.youtube.com/watch?v=8S0FDjFBj8o" 60
 */
import {
  API_ROUTES,
  formatRange,
  formatTimecode,
  type FactCheck,
  type ServerEvent,
  type StartAnalysisRequest,
  type StartAnalysisResponse,
} from "@news/contracts";
import { WebSocket } from "ws";
import { config } from "../config.ts";

const [url, fromArg = "0", uiLanguage = "ru"] = process.argv.slice(2);
if (!url) {
  console.log('Использование: npx tsx backend/src/pipeline/dev-client.ts "<ссылка>" [секунда] [язык UI]');
  process.exit(1);
}

const base = `http://localhost:${config.port}`;
const youtubeId = url.match(/[?&]v=([\w-]{11})/)?.[1];
const request: StartAnalysisRequest = {
  video: { pageUrl: url, platform: youtubeId ? "youtube" : "generic", platformVideoId: youtubeId },
  mode: "remote",
  startFrom: Number(fromArg),
  uiLanguage,
};

// 1. Заявка — так делает расширение, когда нашло видео
const res = await fetch(base + API_ROUTES.startJob, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(request),
}).catch(() => {
  console.error(`❌ Сервер не отвечает на ${base}. Запусти его: npm run dev`);
  process.exit(1);
});
const { jobId, eventsUrl, cached } = (await res.json()) as StartAnalysisResponse;
console.log(`📨 job ${jobId}${cached ? " (из кэша)" : ""}\n🔌 ${eventsUrl}\n`);

// 2. WebSocket — сюда сервер шлёт события по мере готовности
const t0 = Date.now();
const time = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`.padStart(7);
const ws = new WebSocket(eventsUrl);

ws.on("message", (raw) => {
  const e = JSON.parse(raw.toString()) as ServerEvent;
  switch (e.type) {
    case "job.started":
      console.log(
        `${time()} 🎬 job.started    ${e.video.title} · ${e.video.durationSec} с · ${e.video.language}`,
      );
      break;
    case "job.progress":
      console.log(
        `${time()} ⏩ job.progress   обработано до ${formatTimecode(e.processedUntil)} (${e.stage})`,
      );
      break;
    case "claim.detected":
      console.log(`${time()} 🔎 claim.detected ${line(e.factCheck)}`);
      break;
    case "claim.checked":
      console.log(`${time()} ✅ claim.checked  ${line(e.factCheck)}`);
      if (e.factCheck.verdict?.summary) console.log(`${" ".repeat(24)}${e.factCheck.verdict.summary}`);
      break;
    case "job.completed":
      console.log(`${time()} 🏁 job.completed  тезисов: ${e.report.factChecks.length}`);
      ws.close();
      break;
    case "job.failed":
      console.log(`${time()} 💥 job.failed     ${e.error.code}: ${e.error.message}`);
      ws.close();
      break;
  }
});
ws.on("close", () => process.exit(0));
ws.on("error", (err) => {
  console.error("WS ошибка:", err.message);
  process.exit(1);
});

function line(fc: FactCheck): string {
  const verdict = fc.verdict
    ? ` → ${fc.verdict.score ?? "—"}/10 ${fc.verdict.label} · источников: ${fc.sources.length}`
    : fc.status === "failed"
      ? ` → ошибка: ${fc.error}`
      : "";
  return `[${formatRange(fc.range)}] «${fc.claim}»${verdict}`;
}
