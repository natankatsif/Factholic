/**
 * Внутренние сообщения content script <-> service worker (chrome.runtime).
 * Бэкенд про них не знает — это зона фронта.
 */
import type { ServerEvent, Seconds, StartAnalysisRequest } from "@news/contracts";

export type ContentToBackground =
  | { type: "analysis.start"; request: StartAnalysisRequest }
  | { type: "playback"; currentTime: Seconds; playing: boolean; rate: number }
  | { type: "analysis.stop" };

/** Service worker просто пересылает во вкладку события бэкенда */
export type BackgroundToContent = { type: "server.event"; event: ServerEvent };

export const BACKEND_URL = "http://localhost:8787";

/** true — не ходить на бэкенд, проигрывать MOCK_EVENTS прямо в service worker */
export const USE_MOCK = true;
