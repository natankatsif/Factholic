/**
 * YouTube: id видео из ссылки и загрузка IFrame Player API (плеер на экране разбора видео).
 */
import type { VideoInfo } from "@news/contracts";

const ID_RE = /^[\w-]{11}$/;

/**
 * Id видео из любой ссылки YouTube: watch?v=, youtu.be/, shorts/, embed/, live/, m.youtube.com.
 * Не YouTube или ссылка без видео — null.
 */
export function youtubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, rest] = url.pathname.split("/");
    id =
      kind === "watch"
        ? url.searchParams.get("v")
        : ["shorts", "embed", "live", "v"].includes(kind ?? "")
          ? (rest ?? null)
          : null;
  }
  return id && ID_RE.test(id) ? id : null;
}

/** Id видео отчёта: из platformVideoId (если это YouTube) или из ссылки на страницу */
export function reportYoutubeId(video: VideoInfo | undefined): string | null {
  if (!video) return null;
  if (video.platform === "youtube" && video.platformVideoId && ID_RE.test(video.platformVideoId)) {
    return video.platformVideoId;
  }
  return youtubeVideoId(video.pageUrl);
}

// ---------------------------------------------------------------------------
// IFrame Player API: только то, что нужно плееру разбора

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  /** "hd1080", "hd720", "large"… — для плашки качества */
  getPlaybackQuality(): string;
  /** Субтитры: недокументированный, но рабочий модуль "captions" */
  loadModule(name: string): void;
  unloadModule(name: string): void;
  destroy(): void;
}

/** Состояние плеера из onStateChange */
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** "hd1080" → "1080p"; неизвестное — пусто */
export function qualityLabel(quality: string): string {
  const map: Record<string, string> = {
    highres: "4K+",
    hd2160: "4K",
    hd1440: "1440p",
    hd1080: "1080p",
    hd720: "720p",
    large: "480p",
    medium: "360p",
    small: "240p",
    tiny: "144p",
  };
  return map[quality] ?? "";
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Скрипт API грузится один раз на страницу */
export function loadYoutubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Не удалось загрузить плеер YouTube"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
