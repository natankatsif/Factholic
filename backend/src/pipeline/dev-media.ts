/**
 * Ручной прогон медиа-части (backend-1): видео → куски (этап 01) → текст с таймкодами (этап 02).
 * Всегда вызывает REAL-реализации, STAGE_* в .env не важны. Для Whisper нужны ASR_PROVIDER/ASR_API_KEY в .env.
 *
 *   npx tsx backend/src/pipeline/dev-media.ts <ссылка> [с какой секунды] [сколько кусков] [--audio]
 *
 * Примеры:
 *   npx tsx backend/src/pipeline/dev-media.ts "https://www.youtube.com/watch?v=8S0FDjFBj8o" 60 2
 *   npx tsx backend/src/pipeline/dev-media.ts "https://www.youtube.com/watch?v=jNQXAC9IVRw" 0 1 --audio
 *
 * Вместо ссылки можно передать текст в кавычках — он пойдёт как вставленный пост/статья.
 * --audio — игнорировать субтитры и распознавать звук через Whisper (стоит денег, ~$0.006 за минуту).
 */
import { formatRange } from "@news/contracts";
import { cutWav, downloadAudio, SAMPLE_RATE } from "../stages/01-ingest/audio.ts";
import { ingestReal } from "../stages/01-ingest/real.ts";
import type { MediaChunk } from "../stages/01-ingest/types.ts";
import { transcribeReal } from "../stages/02-transcription/real.ts";
import type { StageContext } from "./context.ts";

const args = process.argv.slice(2);
const forceAudio = args.includes("--audio");
const [url, fromArg = "0", countArg = "2"] = args.filter((a) => a !== "--audio");
if (!url) {
  console.log(
    'Использование: npx tsx backend/src/pipeline/dev-media.ts "<ссылка>" [секунда] [кусков] [--audio]',
  );
  process.exit(1);
}
const startFrom = Number(fromArg);
const isUrl = /^https?:\/\//.test(url);
const maxChunks = Number(countArg);
const CHUNK_SEC = 30;

const ctx: StageContext = {
  jobId: "dev",
  signal: AbortSignal.timeout(300_000),
  log: (msg, data) => console.log(`  · ${msg}`, data ?? ""),
};

console.log(
  `\n▶ ${url}  с ${startFrom} с, кусков: ${maxChunks}${forceAudio ? ", режим: только звук" : ""}\n`,
);
const t0 = Date.now();

const { video, chunks } = await ingestReal(
  {
    jobId: "dev",
    chunkSec: CHUNK_SEC,
    request: {
      // не ссылка — значит вставленный текст (как вкладка «Текст» на сайте)
      ...(isUrl ? {} : { text: url }),
      video: { pageUrl: isUrl ? url : "text://pasted", platform: "generic" },
      mode: "remote",
      startFrom,
      uiLanguage: "ru",
    },
  },
  ctx,
);
console.log(`🎬 ${video.title} · ${Math.round(video.durationSec)} с · язык: ${video.language}\n`);

const source: AsyncIterable<MediaChunk> = forceAudio ? audioOnly() : chunks;
let n = 0;
for await (const chunk of source) {
  if (n++ >= maxChunks) break;
  const t = Date.now();
  const out = await transcribeReal({ chunk }, ctx);
  console.log(
    `━━ кусок #${chunk.seq} [${formatRange(chunk.range)}] · ${chunk.kind === "captions" ? `субтитры ${chunk.origin}` : chunk.kind === "text" ? `текст (${chunk.origin})` : "звук → Whisper"} · ${Date.now() - t} мс`,
  );
  for (const s of out.segments) {
    console.log(`  ${formatRange(s)}  ${s.text}   (слов: ${s.words?.length ?? 0})`);
  }
  console.log();
}
console.log(`✅ готово за ${((Date.now() - t0) / 1000).toFixed(1)} с`);

/** Для --audio: скачать звук и резать его, даже если у видео есть субтитры */
async function* audioOnly(): AsyncIterable<MediaChunk> {
  const file = await downloadAudio(url!, `dev_${url!.replace(/\W/g, "").slice(-20)}`, ctx.signal);
  for (let s = startFrom, seq = 0; s < video.durationSec; s += CHUNK_SEC, seq++) {
    const end = Math.min(s + CHUNK_SEC, video.durationSec);
    yield {
      kind: "audio",
      jobId: "dev",
      seq,
      range: { start: s, end },
      format: "wav",
      sampleRate: SAMPLE_RATE,
      channels: 1,
      data: await cutWav(file, s, end - s, ctx.signal),
    };
  }
}
