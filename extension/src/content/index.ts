/**
 * Content script: находит видео, запускает анализ, хранит факт-чеки и показывает их на нужном таймкоде.
 */
import type { FactCheck, ServerEvent } from "@news/contracts";
import type { BackgroundToContent, ContentToBackground } from "../shared/messages.ts";
import { renderOverlay } from "./overlay.ts";
import { describeVideo, findMainVideo } from "./video-detector.ts";

const factChecks = new Map<string, FactCheck>();

function send(msg: ContentToBackground) {
  void chrome.runtime.sendMessage(msg);
}

function attach(video: HTMLVideoElement) {
  const ref = describeVideo(video);
  send({
    type: "analysis.start",
    request: {
      video: ref,
      mode: ref.mediaUrl || ref.platform !== "generic" ? "remote" : "live",
      startFrom: video.currentTime,
      languageHint: document.documentElement.lang || undefined,
      uiLanguage: navigator.language.slice(0, 2),
    },
  });

  video.addEventListener("timeupdate", () =>
    renderOverlay(video, [...factChecks.values()], video.currentTime),
  );
  for (const ev of ["play", "pause", "seeked", "ratechange"] as const) {
    video.addEventListener(ev, () =>
      send({
        type: "playback",
        currentTime: video.currentTime,
        playing: !video.paused,
        rate: video.playbackRate,
      }),
    );
  }
}

chrome.runtime.onMessage.addListener((msg: BackgroundToContent) => {
  if (msg.type === "server.event") handleEvent(msg.event);
});

function handleEvent(event: ServerEvent) {
  switch (event.type) {
    case "claim.detected":
    case "claim.checked":
      factChecks.set(event.factCheck.id, event.factCheck);
      break;
    case "job.completed":
      for (const fc of event.report.factChecks) factChecks.set(fc.id, fc);
      break;
  }
}

// TODO(frontend): SPA-навигация (YouTube меняет видео без перезагрузки) → MutationObserver / yt-navigate-finish
const video = findMainVideo();
if (video) attach(video);
