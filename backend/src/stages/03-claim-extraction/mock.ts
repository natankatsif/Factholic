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
};

export const mockClaimExtractionOutput: ClaimExtractionOutput = {
  // "и это влияет на цены на всё" — слишком размыто, не извлечено
  claims: [mockClaim],
};
