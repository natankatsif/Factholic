/**
 * Субтитры YouTube: выбрать дорожку → скачать в формате json3 → превратить в cues.
 *
 * Формат json3 (родной формат YouTube):
 *   { events: [ { tStartMs: 19560, dDurationMs: 5280, segs: [ { utf8: "Hear" }, { utf8: " that?", tOffsetMs: 160 } ] } ] }
 *   - tStartMs     — начало строки в миллисекундах от начала видео
 *   - segs         — куски текста; в автосубтитрах это отдельные слова
 *   - tOffsetMs    — сдвиг слова от начала строки (у первого слова его нет = 0)
 */
import type { LanguageCode, Seconds } from "@news/contracts";
import type { CaptionsChunk } from "./types.ts";

export type Cue = CaptionsChunk["cues"][number];

/** Кусок того, что возвращает `yt-dlp -J`, который нам нужен */
export interface YtMeta {
  id: string;
  title: string;
  duration?: number;
  language?: string | null;
  thumbnail?: string;
  /** "Youtube", "Vimeo"... "Generic" — yt-dlp не знает сайт и просто нашёл на странице медиафайл */
  extractor_key?: string;
  /** Дата публикации: unix-время или "YYYYMMDD" */
  timestamp?: number;
  release_timestamp?: number;
  upload_date?: string;
  subtitles?: Record<string, Array<{ ext: string; url: string }>>;
  automatic_captions?: Record<string, Array<{ ext: string; url: string }>>;
}

export interface CaptionTrack {
  url: string;
  language: LanguageCode;
  origin: "manual" | "auto";
}

/**
 * Какую дорожку брать (по убыванию качества):
 *   1. ручные субтитры на языке видео — их загрузил автор, они самые точные;
 *   2. автосубтитры "<язык>-orig" — YouTube распознал речь сам (есть время каждого слова);
 *   3. ничего → вернём null, и этап пойдёт по пути "скачать звук".
 * Автопереводы (en → ru и т.п.) не берём: это машинный перевод, а не то, что сказал спикер.
 */
export function pickCaptionTrack(meta: YtMeta, languageHint?: LanguageCode): CaptionTrack | null {
  const json3 = (tracks?: Array<{ ext: string; url: string }>) => tracks?.find((t) => t.ext === "json3")?.url;

  const wanted = [meta.language, languageHint].filter((l): l is string => !!l);
  for (const lang of wanted) {
    const url = json3(meta.subtitles?.[lang]);
    if (url) return { url, language: lang, origin: "manual" };
  }

  const origKey = Object.keys(meta.automatic_captions ?? {}).find((k) => k.endsWith("-orig"));
  if (origKey) {
    const url = json3(meta.automatic_captions![origKey]);
    if (url) return { url, language: origKey.replace(/-orig$/, ""), origin: "auto" };
  }
  return null;
}

interface Json3 {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string; tOffsetMs?: number }>;
  }>;
}

/**
 * Скачивает дорожку и превращает её в плоский список cues с АБСОЛЮТНЫМ временем в секундах.
 * Для автосубтитров одна cue = одно слово (пословные таймкоды для этапов 02/03).
 * Для ручных — одна cue = одна строка субтитров.
 */
export async function loadCues(track: CaptionTrack, signal: AbortSignal): Promise<Cue[]> {
  const res = await fetch(track.url, { signal });
  // Субтитры не скачались — не фатально: real.ts уйдёт на путь "звук → Whisper"
  if (!res.ok) throw new Error(`субтитры: HTTP ${res.status}`);
  const data = (await res.json()) as Json3;

  // Оставляем только строки с текстом (YouTube вставляет пустые события с "\n")
  const events = (data.events ?? []).filter((e) => e.segs?.some((s) => s.utf8?.trim()));

  const cues: Cue[] = [];
  events.forEach((e, i) => {
    const start = (e.tStartMs ?? 0) / 1000;
    // Строки автосубтитров "наезжают" друг на друга, поэтому конец строки = начало следующей
    const nextStart = events[i + 1]?.tStartMs;
    const ownEnd = start + (e.dDurationMs ?? 0) / 1000;
    const end = nextStart !== undefined ? Math.min(ownEnd, nextStart / 1000) : ownEnd;

    const segs = (e.segs ?? []).filter((s) => s.utf8?.trim());
    if (track.origin === "manual" || segs.length === 1) {
      cues.push({ start, end, text: clean(segs.map((s) => s.utf8).join("")) });
      return;
    }
    segs.forEach((s, j) => {
      const wStart = start + (s.tOffsetMs ?? 0) / 1000;
      const next = segs[j + 1];
      const wEnd = next ? start + (next.tOffsetMs ?? 0) / 1000 : end;
      cues.push({ start: wStart, end: Math.max(wStart, wEnd), text: clean(s.utf8!) });
    });
  });
  return cues.filter((c) => c.text);
}

/**
 * Режет cues на куски по chunkSec, начиная с startFrom.
 * range куска — абсолютное время в видео: [1200, 1230), [1230, 1260) ...
 */
export function groupCues(cues: Cue[], startFrom: Seconds, chunkSec: Seconds, duration: Seconds) {
  const groups: Array<{ start: Seconds; end: Seconds; cues: Cue[] }> = [];
  const last = Math.max(duration, cues.at(-1)?.end ?? 0);
  for (let t = startFrom; t < last; t += chunkSec) {
    const end = Math.min(t + chunkSec, last);
    // cue попадает в кусок, где она началась
    groups.push({ start: t, end, cues: cues.filter((c) => c.start >= t && c.start < end) });
  }
  return groups;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
