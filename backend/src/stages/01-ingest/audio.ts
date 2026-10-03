/**
 * Звук: скачать дорожку через yt-dlp (один раз, с кэшем на диске) и вырезать куски через ffmpeg.
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Seconds } from "@news/contracts";
import { run } from "./process.ts";

/** Частота, которую ожидают почти все ASR (Whisper, Deepgram...). Больше — только лишний трафик. */
export const SAMPLE_RATE = 16000;

const CACHE_DIR = join(tmpdir(), "factcheck-audio");

/**
 * Скачивает только аудиодорожку (без видео) и возвращает путь к файлу.
 * Кэш: если файл для этого cacheKey уже скачан — второй раз не качаем.
 */
export async function downloadAudio(pageUrl: string, cacheKey: string, signal: AbortSignal): Promise<string> {
  const dir = join(CACHE_DIR, cacheKey.replace(/[^\w-]/g, "_"));
  const cached = existsSync(dir) && readdirSync(dir).find((f) => f.startsWith("audio."));
  if (cached) return join(dir, cached);

  mkdirSync(dir, { recursive: true });
  const out = await run(
    "yt-dlp",
    [
      "-f",
      "bestaudio/best", // самая лёгкая дорожка со звуком
      "--no-playlist",
      "-o",
      join(dir, "audio.%(ext)s"), // расширение подставит yt-dlp (webm, m4a...)
      "--print",
      "after_move:filepath", // в stdout — итоговый путь к файлу
      pageUrl,
    ],
    signal,
  );
  return out.toString().trim().split("\n").at(-1)!;
}

/**
 * Вырезает кусок [start, start + duration) и перекодирует в WAV 16 kHz mono.
 * source — путь к файлу или прямая http-ссылка на медиа (ffmpeg умеет и то и другое).
 * Результат не пишется на диск: ffmpeg отдаёт его в stdout ("pipe:1").
 */
export async function cutWav(
  source: string,
  start: Seconds,
  duration: Seconds,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const wav = await run(
    "ffmpeg",
    [
      "-v",
      "error",
      "-ss",
      String(start), // перемотать на начало куска (до -i — быстрый поиск)
      "-t",
      String(duration), // взять duration секунд
      "-i",
      source,
      "-vn", // без видео
      "-ac",
      "1", // моно
      "-ar",
      String(SAMPLE_RATE),
      "-f",
      "wav",
      "pipe:1",
    ],
    signal,
  );
  return new Uint8Array(wav);
}
