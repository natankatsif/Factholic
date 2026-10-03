import type { ISODateString, LanguageCode, VideoInfo } from "@news/contracts";
import { PipelineError, type Stage, type StageContext } from "../../pipeline/context.ts";
import { fetchArticle, guessLanguage, MIN_ARTICLE_CHARS, splitText } from "./article.ts";
import { cutWav, downloadAudio, SAMPLE_RATE } from "./audio.ts";
import { groupCues, loadCues, pickCaptionTrack, type YtMeta } from "./captions.ts";
import { run } from "./process.ts";
import type { AudioChunk, IngestInput, IngestOutput, LiveAudioChunk, MediaChunk } from "./types.ts";
import type { StartAnalysisRequest } from "@news/contracts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_INGEST=real)
 *
 * text:   пользователь вставил текст (request.text) → TextChunk по абзацам, ничего не скачиваем
 * remote: yt-dlp -J (метаданные) →
 *           сайт не видеоплатформа (yt-dlp его не знает) → читаем как статью: текст + дата из разметки
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

  // 0. Вставленный текст — ничего не скачиваем
  if (request.text?.trim()) {
    const text = request.text.trim();
    const language = request.languageHint ?? guessLanguage(text);
    ctx.log(`ingest: вставленный текст, ${text.length} символов`);
    return textOutput(jobId, "pasted", text, {
      pageUrl: ref.pageUrl,
      platform: ref.platform,
      title: ref.title ?? firstWords(text),
      durationSec: 0,
      language,
    });
  }

  // 0b. Картинка: загруженный скриншот или ссылка прямо на изображение → этап 02 сделает OCR
  if (request.imageDataUrl) {
    ctx.log("ingest: загруженная картинка");
    return imageOutput(jobId, "upload", decodeDataUrl(request.imageDataUrl), ref, request.languageHint);
  }
  if (IMAGE_URL.test(ref.pageUrl)) {
    ctx.log("ingest: ссылка на картинку");
    return imageOutput(jobId, "url", await fetchImage(ref.pageUrl, ctx.signal), ref, request.languageHint);
  }

  // 1. Метаданные через yt-dlp
  let meta = metaCache.get(cacheKey);
  let ytError: unknown;
  if (!meta) {
    try {
      const json = await run("yt-dlp", ["-J", "--no-playlist", "--skip-download", ref.pageUrl], ctx.signal);
      meta = JSON.parse(json.toString()) as YtMeta;
      metaCache.set(cacheKey, meta);
    } catch (err) {
      ytError = err;
    }
  }

  // 2. Не видеоплатформа (yt-dlp сайт не знает или лишь нашёл на странице медиафайл) → читаем как статью
  const isVideoPlatform = meta ? meta.extractor_key !== "Generic" : knownVideoSite(ytError);
  // yt-dlp узнал сайт ([youtube], [vimeo]…), но видео открыть не смог — это ошибка видео, а не «статья»
  if (!meta && isVideoPlatform) throw ytDlpError(ytError);
  if (!isVideoPlatform && !ref.mediaUrl) {
    const article = await fetchArticle(ref.pageUrl, ctx.signal).catch((err: Error) => {
      ctx.log(`ingest: статью не скачали (${err.message})`);
      return null;
    });
    if (article && article.text.length >= MIN_ARTICLE_CHARS) {
      ctx.log(
        `ingest: статья «${article.title}», ${article.text.length} символов, дата ${article.publishedAt}`,
      );
      return textOutput(jobId, "article", article.text, {
        pageUrl: ref.pageUrl,
        platform: ref.platform,
        title: article.title || ref.title || firstWords(article.text),
        durationSec: 0,
        language: request.languageHint ?? article.language ?? guessLanguage(article.text),
        publishedAt: article.publishedAt,
      });
    }
    if (!meta) {
      // страница не открылась вовсе — это ошибка yt-dlp; открылась, но ни видео, ни статьи — не поддерживаем
      if (!article) throw ytDlpError(ytError);
      throw new PipelineError("UNSUPPORTED_PLATFORM", "На этой странице не нашли ни видео, ни текста статьи");
    }
  }
  if (!meta && !ref.mediaUrl) throw ytDlpError(ytError);
  if (!meta) ctx.log("yt-dlp не смог, режем звук напрямую с mediaUrl", (ytError as Error)?.message);

  let duration =
    meta?.duration ?? ref.durationSec ?? (ref.mediaUrl ? await probeDuration(ref.mediaUrl, ctx) : 0);
  const video: VideoInfo = {
    pageUrl: ref.pageUrl,
    platform: ref.platform,
    platformVideoId: ref.platformVideoId ?? meta?.id,
    title: meta?.title ?? ref.title ?? "Без названия",
    durationSec: duration,
    language: meta?.language ?? request.languageHint ?? "und",
    thumbnailUrl: meta?.thumbnail,
    publishedAt: meta ? ytPublishedAt(meta) : undefined,
  };

  // 2. Есть субтитры → отдаём их, ASR не понадобится
  const track = meta ? pickCaptionTrack(meta, request.languageHint) : null;
  // Субтитры не скачались (YouTube иногда отвечает 429) — не роняем job, а идём по пути "звук → Whisper"
  const cues = track
    ? await loadCues(track, ctx.signal).catch((err: Error) => {
        ctx.log(`ingest: субтитры не скачались (${err.message}), переходим на звук`);
        return null;
      })
    : null;
  if (track && cues?.length) {
    ctx.log(`ingest: субтитры ${track.origin} (${track.language})`);
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
  const source = meta
    ? await downloadAudio(ref.pageUrl, cacheKey, ctx.signal).catch((err: unknown) => {
        throw ytDlpError(err);
      })
    : ref.mediaUrl!;
  // Платформа не сообщила длительность — меряем сам файл
  if (!duration) {
    duration = await probeDuration(source, ctx).catch(() => 0);
    video.durationSec = duration;
  }
  if (!duration) {
    throw new PipelineError("UNSUPPORTED_PLATFORM", "На этой странице не нашли видео");
  }
  const total = duration;
  return {
    video,
    // Генератор: следующий кусок режется только когда оркестратор попросил его (ленивая обработка)
    chunks: (async function* (): AsyncIterable<MediaChunk> {
      let seq = 0;
      for (let start = request.startFrom; start < total; start += chunkSec) {
        if (ctx.signal.aborted) return;
        const end = Math.min(start + chunkSec, total);
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
  if (!liveAudio) throw new PipelineError("INTERNAL", "Live-режим: звук от расширения не поступает");
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

/**
 * Ошибку yt-dlp → понятный код для фронта. Определяем по тексту stderr, который yt-dlp печатает.
 *   "Unsupported URL"                               → сайт не поддерживается
 *   "Video unavailable", "Private video", 404 ...   → видео нет / закрыто
 */
function ytDlpError(err: unknown): PipelineError {
  const text = (err as Error).message;
  if (/не установлен/.test(text)) return new PipelineError("INTERNAL", text, { cause: err });
  if (/Unsupported URL|is not a valid URL|No video formats/i.test(text)) {
    return new PipelineError(
      "UNSUPPORTED_PLATFORM",
      "Этот сайт не поддерживается — не нашли на странице видео",
      {
        cause: err,
      },
    );
  }
  if (/HTTP Error 429|Too Many Requests|confirm you.?re not a bot/i.test(text)) {
    return new PipelineError("RATE_LIMITED", "Платформа временно ограничила запросы, попробуй через минуту", {
      cause: err,
    });
  }
  const reason = /Private video/i.test(text)
    ? "это приватное видео"
    : /confirm your age|age-restricted|Sign in to/i.test(text)
      ? "видео доступно только после входа в аккаунт"
      : /live event|is live|Premieres in/i.test(text)
        ? "трансляция ещё не началась"
        : /Unable to download webpage|Failed to resolve|Connection refused|timed out/i.test(text)
          ? "страница не открывается — проверь ссылку"
          : "видео удалено, недоступно или ссылка неверная";
  return new PipelineError("VIDEO_UNAVAILABLE", `Не удалось открыть видео: ${reason}`, { cause: err });
}

const FIRST_CHUNK_CHARS = 1200;

/** Текст (статья или вставленный) → куски по абзацам. Таймкодов нет: range = 0–0, порядок — seq. */
function textOutput(
  jobId: string,
  origin: "article" | "pasted",
  text: string,
  video: VideoInfo,
): IngestOutput {
  // первый кусок короткий — первые тезисы на экране через ~10 с, а не ~20 с
  const parts = splitText(text, 3000, FIRST_CHUNK_CHARS);
  const language: LanguageCode = video.language;
  return {
    video,
    chunks: (async function* (): AsyncIterable<MediaChunk> {
      for (const [seq, part] of parts.entries()) {
        yield { kind: "text", jobId, seq, range: { start: 0, end: 0 }, language, origin, text: part };
      }
    })(),
  };
}

/** Дата публикации видео: точное время (timestamp), иначе день загрузки "YYYYMMDD" */
function ytPublishedAt(meta: YtMeta): ISODateString | undefined {
  const ts = meta.release_timestamp ?? meta.timestamp;
  if (ts) return new Date(ts * 1000).toISOString();
  const d = meta.upload_date?.match(/^(\d{4})(\d{2})(\d{2})$/);
  return d ? `${d[1]}-${d[2]}-${d[3]}T00:00:00.000Z` : undefined;
}

/** Заголовок для вставленного текста: первые слова */
function firstWords(text: string, max = 100): string {
  const line = text.split("\n")[0]!.trim();
  // первое предложение целиком, если оно короткое; иначе обрезаем по слову
  const sentence = line.match(/^.+?[.!?…](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  return line.length <= max ? line : `${line.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/**
 * yt-dlp узнал сайт? В ошибке видеоплатформы есть имя экстрактора: "ERROR: [youtube] xxx: This video is unavailable".
 * Незнакомый сайт — "Unsupported URL" или "[generic]": такую страницу пробуем прочитать как статью.
 */
function knownVideoSite(err: unknown): boolean {
  const text = (err as Error | undefined)?.message ?? "";
  const extractor = text.match(/\[([\w:.-]+)\]/)?.[1]?.toLowerCase();
  return !!extractor && extractor !== "generic" && !/Unsupported URL/i.test(text);
}

// ---------- картинки ----------

/** Ссылка прямо на файл изображения */
const IMAGE_URL = /\.(png|jpe?g|webp|gif)(\?|#|$)/i;
/** OpenAI принимает картинки до 20 МБ; скриншоту больше и не нужно */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

interface ImageData {
  mimeType: string;
  data: Uint8Array;
}

function imageOutput(
  jobId: string,
  origin: "url" | "upload",
  image: ImageData,
  ref: StartAnalysisRequest["video"],
  languageHint: LanguageCode | undefined,
): IngestOutput {
  return {
    video: {
      pageUrl: ref.pageUrl,
      platform: ref.platform,
      title: ref.title ?? (origin === "upload" ? "Скриншот" : "Изображение"),
      durationSec: 0,
      language: languageHint ?? "und",
    },
    chunks: (async function* (): AsyncIterable<MediaChunk> {
      yield { kind: "image", jobId, seq: 0, range: { start: 0, end: 0 }, origin, ...image };
    })(),
  };
}

/** "data:image/png;base64,iVBOR…" → байты */
function decodeDataUrl(dataUrl: string): ImageData {
  const m = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
  if (!m)
    throw new PipelineError(
      "UNSUPPORTED_PLATFORM",
      "Загруженный файл — не картинка (ожидается PNG, JPEG или WebP)",
    );
  const data = new Uint8Array(Buffer.from(m[2]!, "base64"));
  if (data.length > MAX_IMAGE_BYTES) throw new PipelineError("UNSUPPORTED_PLATFORM", "Картинка больше 15 МБ");
  return { mimeType: m[1]!, data };
}

async function fetchImage(url: string, signal: AbortSignal): Promise<ImageData> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
  } catch (err) {
    throw new PipelineError("VIDEO_UNAVAILABLE", "Не удалось скачать картинку — проверь ссылку", {
      cause: err,
    });
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!res.ok || !mimeType.startsWith("image/")) {
    throw new PipelineError(
      "VIDEO_UNAVAILABLE",
      `Не удалось скачать картинку (HTTP ${res.status}, ${mimeType || "неизвестный тип"})`,
    );
  }
  const data = new Uint8Array(await res.arrayBuffer());
  if (data.length > MAX_IMAGE_BYTES) throw new PipelineError("UNSUPPORTED_PLATFORM", "Картинка больше 15 МБ");
  return { mimeType, data };
}
