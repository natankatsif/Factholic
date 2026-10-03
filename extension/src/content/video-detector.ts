import type { Platform, VideoRef } from "@news/contracts";

/** Самое большое видимое <video> на странице — скорее всего основной плеер */
export function findMainVideo(): HTMLVideoElement | null {
  const videos = [...document.querySelectorAll("video")].filter((v) => v.offsetWidth > 200);
  return videos.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0] ?? null;
}

export function describeVideo(video: HTMLVideoElement): VideoRef {
  const url = new URL(location.href);
  const platform = detectPlatform(url.hostname);
  return {
    pageUrl: location.href,
    platform,
    platformVideoId: platform === "youtube" ? (url.searchParams.get("v") ?? undefined) : undefined,
    mediaUrl: video.currentSrc && !video.currentSrc.startsWith("blob:") ? video.currentSrc : undefined,
    title: document.title,
    durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
  };
}

function detectPlatform(host: string): Platform {
  if (/(^|\.)youtube\.com$|youtu\.be$/.test(host)) return "youtube";
  if (/vimeo\.com$/.test(host)) return "vimeo";
  if (/twitch\.tv$/.test(host)) return "twitch";
  if (/(^|\.)(x|twitter)\.com$/.test(host)) return "x";
  return "generic";
}
