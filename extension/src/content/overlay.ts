import type { FactCheck, Seconds } from "@news/contracts";

/** Сколько секунд держать карточку после окончания фразы */
const LINGER_SEC = 6;

/** Факт-чеки, которые надо показывать в момент currentTime */
export function activeAt(list: FactCheck[], t: Seconds): FactCheck[] {
  return list.filter((fc) => t >= fc.range.start && t <= fc.range.end + LINGER_SEC);
}

/**
 * TODO(frontend): нарисовать UI поверх плеера (Shadow DOM, чтобы стили сайта не ломали).
 * Дизайн делать по MOCK_VIDEO_REPORT из @news/contracts/mocks.
 */
export function renderOverlay(video: HTMLVideoElement, list: FactCheck[], t: Seconds) {
  const active = activeAt(list, t);
  if (active.length)
    console.debug(
      "[factcheck]",
      active.map((f) => `${f.claim} → ${f.verdict?.score ?? "…"}`),
    );
}
