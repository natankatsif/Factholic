import { mockClaim } from "../03-claim-extraction/mock.ts";
import { mockProvenanceTree } from "../05-provenance/mock.ts";
import type { RootDateInput, RootDateOutput } from "./types.ts";

export const mockRootDateInput: RootDateInput = {
  claim: mockClaim,
  tree: mockProvenanceTree,
  videoPublishedAt: "2026-10-02T09:00:00Z",
};

/** «Сейчас идёт война» (time: «сейчас», relative) — корень Reuters от того же дня, флага нет */
export const mockRootDateOutput: RootDateOutput = {
  claimId: "clm_05",
  claimedAt: "2026-10-02T00:00:00Z",
  rootPublishedAt: "2026-10-02T08:00:00Z",
  flag: null,
};

/** Как выглядит флаг: «вчера» (2026-10-01) в видео от 2026-10-02, а первая публикация — январь 2021 */
export const mockOldContentOutput: RootDateOutput = {
  claimId: "clm_09",
  claimedAt: "2026-10-01T00:00:00Z",
  rootPublishedAt: "2021-01-14T07:30:00Z",
  flag: {
    type: "old_content",
    rootPublishedAt: "2021-01-14T07:30:00Z",
    claimedAt: "2026-10-01T00:00:00Z",
    note: "Первая публикация — 14 января 2021, а в видео это подано как вчерашнее событие (1 октября 2026).",
  },
};
