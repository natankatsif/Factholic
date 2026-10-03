import type { Stage } from "../../pipeline/context.ts";
import { mockTranscriptionOutput } from "../02-transcription/mock.ts";
import type { Claim, ClaimExtractionInput, ClaimExtractionOutput } from "./types.ts";

export const mockClaimExtractionInput: ClaimExtractionInput = {
  jobId: "job_mock_01",
  video: {
    pageUrl: "https://www.youtube.com/watch?v=MOCK123",
    platform: "youtube",
    title: "Большое интервью: экономика, наука и мировые события",
    durationSec: 1860,
    language: "ru",
  },
  segments: mockTranscriptionOutput.segments,
  context: [],
  previousClaims: [{ id: "clm_04", normalized: "В следующем году инфляция снизится вдвое." }],
  language: "ru",
};

export const mockClaim: Claim = {
  id: "clm_05",
  jobId: "job_mock_01",
  range: { start: 1221.0, end: 1223.0 },
  quote: "в Украине сейчас идёт война",
  normalized: "На территории Украины идёт война.",
  category: "event",
  checkworthiness: 0.82,
  language: "ru",
  entities: ["Украина"],
  segmentIds: ["0_1"],
  speaker: "SPEAKER_1",
  structure: {
    numbers: [],
    places: ["Украина"],
    eventTime: null,
    // «сейчас идёт» — подаётся как происходящее на момент видео
    timeMarkers: ["today"],
    certainty: "asserted",
    attributedTo: null,
  },
};

export const mockClaimExtractionOutput: ClaimExtractionOutput = {
  // "и это влияет на цены на всё" — слишком размыто, не извлечено
  claims: [mockClaim],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_CLAIM_EXTRACTION=mock) =====================

export const extractClaimsMock: Stage<ClaimExtractionInput, ClaimExtractionOutput> = async (input) => {
  return { claims: mockClaimExtractionOutput.claims.map((c) => ({ ...c, jobId: input.jobId })) };
};
