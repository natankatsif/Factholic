import type { Stage } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import { mockSourceSearchOutput } from "../04-source-search/mock.ts";
import type { VerificationInput, VerificationOutput } from "./types.ts";

export const mockVerificationInput: VerificationInput = {
  claim: mockClaim,
  sources: mockSourceSearchOutput.sources,
  surroundingText:
    "Давайте немного о том, что происходит в мире. В Украине сейчас идёт война, и это, конечно, влияет на цены на всё.",
  uiLanguage: "ru",
};

export const mockVerificationOutput: VerificationOutput = {
  claimId: "clm_05",
  score: 10,
  label: "true",
  confidence: 0.98,
  summary: "Подтверждается международными организациями и СМИ разных стран.",
  explanation:
    "Полномасштабные боевые действия на территории Украины ведутся с февраля 2022 года. Это фиксируют ООН, международные организации и издания из разных стран, независимо от того, какие термины они используют для описания событий.",
  sourceAssessments: [
    { sourceId: "src_05_1", stance: "supports", relevance: 0.95 },
    { sourceId: "src_05_2", stance: "supports", relevance: 0.9 },
    { sourceId: "src_05_3", stance: "supports", relevance: 0.9 },
    { sourceId: "src_05_4", stance: "supports", relevance: 0.85 },
  ],
  model: "mock",
  checkedAt: "2026-10-03T10:02:05Z",
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_VERIFICATION=mock) =====================

export const verifyMock: Stage<VerificationInput, VerificationOutput> = async (input) => {
  return { ...mockVerificationOutput, claimId: input.claim.id };
};
