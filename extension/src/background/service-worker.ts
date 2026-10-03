/**
 * Держит соединение с бэкендом (одно на вкладку) и пересылает события в content script.
 */
import {
  API_ROUTES,
  type ClientMessage,
  type ServerEvent,
  type StartAnalysisRequest,
  type StartAnalysisResponse,
} from "@news/contracts";
import { MOCK_EVENTS } from "@news/contracts/mocks";
import {
  BACKEND_URL,
  USE_MOCK,
  type BackgroundToContent,
  type ContentToBackground,
} from "../shared/messages.ts";

const sockets = new Map<number, WebSocket>();

chrome.runtime.onMessage.addListener((msg: ContentToBackground, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  switch (msg.type) {
    case "analysis.start":
      void (USE_MOCK ? playMock(tabId) : start(tabId, msg.request));
      break;
    case "playback":
      send(tabId, { type: "playback", currentTime: msg.currentTime, playing: msg.playing, rate: msg.rate });
      break;
    case "analysis.stop":
      send(tabId, { type: "cancel" });
      sockets.get(tabId)?.close();
      sockets.delete(tabId);
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sockets.get(tabId)?.close();
  sockets.delete(tabId);
});

async function start(tabId: number, request: StartAnalysisRequest) {
  const res = await fetch(BACKEND_URL + API_ROUTES.startJob, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const { eventsUrl } = (await res.json()) as StartAnalysisResponse;
  const ws = new WebSocket(eventsUrl);
  sockets.set(tabId, ws);
  ws.onmessage = (e) => forward(tabId, JSON.parse(e.data) as ServerEvent);
}

function playMock(tabId: number) {
  for (const { atMs, event } of MOCK_EVENTS) setTimeout(() => forward(tabId, event), atMs);
}

function send(tabId: number, msg: ClientMessage) {
  const ws = sockets.get(tabId);
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function forward(tabId: number, event: ServerEvent) {
  const msg: BackgroundToContent = { type: "server.event", event };
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}
