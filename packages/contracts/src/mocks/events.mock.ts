/**
 * Поток событий WS, как его увидит расширение. Собран из MOCK_VIDEO_REPORT.
 * Используется mock-сервером (npm run dev:mock) и может использоваться фронтом без сервера.
 */
import type { ServerEvent } from "../api.ts";
import type { FactCheck } from "../fact-check.ts";
import { MOCK_VIDEO_REPORT } from "./video-report.mock.ts";

export interface TimedEvent {
  /** Через сколько мс после подключения отправить */
  atMs: number;
  event: ServerEvent;
}

export function buildMockEventTimeline(report = MOCK_VIDEO_REPORT): TimedEvent[] {
  const { jobId, video } = report;
  const timeline: TimedEvent[] = [{ atMs: 0, event: { type: "job.started", jobId, video } }];
  let t = 300;

  for (const fc of report.factChecks) {
    const pending: FactCheck = { ...fc, status: "checking", verdict: null, sources: [] };
    timeline.push({
      atMs: t,
      event: { type: "job.progress", jobId, processedUntil: fc.range.end, stage: "claim_extraction" },
    });
    timeline.push({ atMs: t, event: { type: "claim.detected", jobId, factCheck: pending } });
    t += 1200;
    if (fc.status !== "checking") {
      timeline.push({ atMs: t, event: { type: "claim.checked", jobId, factCheck: fc } });
      t += 400;
    }
  }

  timeline.push({
    atMs: t + 500,
    event: { type: "job.progress", jobId, processedUntil: report.processedUntil, stage: "transcription" },
  });
  return timeline;
}

export const MOCK_EVENTS: TimedEvent[] = buildMockEventTimeline();
