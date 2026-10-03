/** Секунды от начала видео (дробные). Таймкод 20:21 → 1221. */
export type Seconds = number;

/** Отрезок видео. Пример: 20:21–20:23 → { start: 1221, end: 1223 } */
export interface TimeRange {
  start: Seconds;
  end: Seconds;
}

export type JobId = string;
export type ClaimId = string;
export type SourceId = string;

/** ISO 8601, например "2026-10-03T12:00:00Z" */
export type ISODateString = string;

/** ISO 639-1: "ru", "en", "uk", ... */
export type LanguageCode = string;

export type Platform = "youtube" | "vimeo" | "twitch" | "x" | "generic";

/** То, что расширение знает о видео на странице в момент детекта. */
export interface VideoRef {
  /** URL страницы, где найдено видео */
  pageUrl: string;
  platform: Platform;
  /** ID на платформе, например YouTube "dQw4w9WgXcQ" */
  platformVideoId?: string;
  /** Прямой src у <video>, если это не blob: */
  mediaUrl?: string;
  title?: string;
  durationSec?: Seconds;
}

/** То, что бэкенд знает о видео после обработки (показывается в UI). */
export interface VideoInfo {
  pageUrl: string;
  platform: Platform;
  platformVideoId?: string;
  title: string;
  durationSec: Seconds;
  /** Язык речи в видео (определён бэкендом) */
  language: LanguageCode;
  thumbnailUrl?: string;
  /**
   * Когда видео/статья опубликованы на платформе (из yt-dlp или разметки страницы).
   * Нужно, чтобы поймать «старый контент»: корень дерева сильно раньше, чем заявляет материал.
   */
  publishedAt?: ISODateString;
}

/** 1221.4 → "20:21", 3725 → "1:02:05" */
export function formatTimecode(sec: Seconds): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** { start: 1221, end: 1223 } → "20:21–20:23" */
export function formatRange(range: TimeRange): string {
  return `${formatTimecode(range.start)}–${formatTimecode(range.end)}`;
}
