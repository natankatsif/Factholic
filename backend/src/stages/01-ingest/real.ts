import type { VideoInfo } from "@news/contracts";
import type { Stage, StageContext } from "../../pipeline/context.ts";
import { cutWav, downloadAudio, SAMPLE_RATE } from "./audio.ts";
import { groupCues, loadCues, pickCaptionTrack, type YtMeta } from "./captions.ts";
import { run } from "./process.ts";
import type { AudioChunk, IngestInput, IngestOutput, LiveAudioChunk, MediaChunk } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_INGEST=real)
 *
 * remote: yt-dlp -J (метаданные) →
 *           есть субтитры?  → CaptionsChunk по chunkSec (ASR не нужен)
 *           нет             → скачать звук → ffmpeg 16 kHz mono → AudioChunk по chunkSec
 *         yt-dlp не смог, но расширение прислало прямой mediaUrl → режем звук прямо с него
 * live:   звук шлёт расширение по WS → перекладываем в AudioChunk
 */
export const ingestReal: Stage<IngestInput, IngestOutput> = async (input, ctx) => {
  if (input.request.mode === "live") return ingestLive(input);
  return ingestRemote(input, ctx);
};

/** Кэш метаданных в памяти: одно видео не спрашиваем у YouTube дважды */
const metaCache = new Map<string, YtMeta>();

async function ingestRemote(input: IngestInput, ctx: StageContext): Promise<IngestOutput> {
  const { request, jobId, chunkSec } = input;
  const ref = request.video;
  const cacheKey = `${ref.platform}_${ref.platformVideoId ?? ref.pageUrl}`;

  // 1. Метаданные через yt-dlp. Если сайт не поддерживается — пробуем прямой mediaUrl.
  let meta = metaCache.get(cacheKey);
  if (!meta) {
    try {
      const json = await run("yt-dlp", ["-J", "--no-playlist", "--skip-download", ref.pageUrl], ctx.signal);
      meta = JSON.parse(json.toString()) as YtMeta;
      metaCache.set(cacheKey, meta);
    } catch (err) {
      if (!ref.mediaUrl) throw new Error(`видео недоступно: ${(err as Error).message}`, { cause: err });
      ctx.log("yt-dlp не смог, режем звук напрямую с mediaUrl", (err as Error).message);
    }
  }

  const duration =
    meta?.duration ?? ref.durationSec ?? (ref.mediaUrl ? await probeDuration(ref.mediaUrl, ctx) : 0);
  const video: VideoInfo = {
    pageUrl: ref.pageUrl,
    platform: ref.platform,
    platformVideoId: ref.platformVideoId ?? meta?.id,
    title: meta?.title ?? ref.title ?? "Без названия",
    durationSec: duration,
    language: meta?.language ?? request.languageHint ?? "und",
    thumbnailUrl: meta?.thumbnail,
  };

  // 2. Есть субтитры → отдаём их, ASR не понадобится
  const track = meta ? pickCaptionTrack(meta, request.languageHint) : null;
  if (track) {
    ctx.log(`ingest: субтитры ${track.origin} (${track.language})`);
    const cues = await loadCues(track, ctx.signal);
    const groups = groupCues(cues, request.startFrom, chunkSec, duration);
    video.language = track.language;
    return {
      video,
      chunks: (async function* (): AsyncIterable<MediaChunk> {
        for (const [seq, g] of groups.entries()) {
          if (ctx.signal.aborted) return;
          yield {
            kind: "captions",
            jobId,
            seq,
            range: { start: g.start, end: g.end },
            language: track.language,
            origin: track.origin,
            cues: g.cues,
          };
        }
      })(),
    };
  }

  // 3. Субтитров нет → звук. Источник: скачанный файл (YouTube и пр.) или прямой mediaUrl.
  ctx.log("ingest: субтитров нет, режем звук");
  const source = meta ? await downloadAudio(ref.pageUrl, cacheKey, ctx.signal) : ref.mediaUrl!;
  return {
    video,
    // Генератор: следующий кусок режется только когда оркестратор попросил его (ленивая обработка)
    chunks: (async function* (): AsyncIterable<MediaChunk> {
      let seq = 0;
      for (let start = request.startFrom; start < duration; start += chunkSec) {
        if (ctx.signal.aborted) return;
        const end = Math.min(start + chunkSec, duration);
        const chunk: AudioChunk = {
          kind: "audio",
          jobId,
          seq: seq++,
          range: { start, end },
          format: "wav",
          sampleRate: SAMPLE_RATE,
          channels: 1,
          data: await cutWav(source, start, end - start, ctx.signal),
        };
        yield chunk;
      }
    })(),
  };
}

/** live: звук приходит от расширения уже кусками — только переупаковываем */
async function ingestLive(input: IngestInput): Promise<IngestOutput> {
  const { request, jobId, liveAudio } = input;
  if (!liveAudio) throw new Error("live-режим: нет потока liveAudio от сервера");
  const ref = request.video;
  return {
    video: {
      pageUrl: ref.pageUrl,
      platform: ref.platform,
      platformVideoId: ref.platformVideoId,
      title: ref.title ?? "Без названия",
      durationSec: ref.durationSec ?? 0,
      language: request.languageHint ?? "und",
    },
    chunks: (async function* (): AsyncIterable<MediaChunk> {
      for await (const c of liveAudio as AsyncIterable<LiveAudioChunk>) {
        const isWav = c.mimeType.startsWith("audio/wav");
        yield {
          kind: "audio",
          jobId,
          seq: c.seq,
          range: c.range,
          format: isWav ? "wav" : "webm",
          sampleRate: isWav ? SAMPLE_RATE : 48000, // MediaRecorder в Chrome пишет opus 48 kHz
          channels: 1,
          data: c.data,
        };
      }
    })(),
  };
}

/** Длительность медиа по прямой ссылке (если yt-dlp её не дал) */
async function probeDuration(url: string, ctx: StageContext): Promise<number> {
  const out = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url],
    ctx.signal,
  );
  return Number(out.toString().trim()) || 0;
}
