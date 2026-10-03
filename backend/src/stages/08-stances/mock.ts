import type { Stage } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import { mockSourceSearchOutput } from "../04-source-search/mock.ts";
import { mockProvenanceTree } from "../05-provenance/mock.ts";
import type { StancesInput, StancesOutput } from "./types.ts";

export const mockStancesInput: StancesInput = {
  claim: mockClaim,
  sources: mockSourceSearchOutput.sources,
  surroundingText:
    "Давайте немного о том, что происходит в мире. В Украине сейчас идёт война, и это, конечно, влияет на цены на всё.",
  uiLanguage: "ru",
  voteGroups: mockProvenanceTree.voteGroups,
};

/** 3 источника «за», но DW пересказывает Reuters — независимых групп «за» две; Википедия — mixed */
export const mockStancesOutput: StancesOutput = {
  claimId: "clm_05",
  consensus: {
    status: "agree",
    groupsFor: 2,
    groupsAgainst: 0,
    summary: "ООН, Reuters и Deutsche Welle сообщают о продолжающихся боевых действиях.",
    explanation:
      "Сообщение DW основано на данных Reuters, поэтому они считаются одной группой. Вместе с ООН — две независимые группы «за»; Википедия подтверждает только начало войны в 2022 году.",
  },
  sourceAssessments: [
    { sourceId: "src_05_1", stance: "supports", relevance: 0.95 },
    { sourceId: "src_05_2", stance: "supports", relevance: 0.9 },
    { sourceId: "src_05_3", stance: "supports", relevance: 0.9 },
    { sourceId: "src_05_4", stance: "mixed", relevance: 0.6 },
  ],
  model: "mock",
  checkedAt: "2026-10-03T10:02:05Z",
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_STANCES=mock) =====================

export const assessStancesMock: Stage<StancesInput, StancesOutput> = async (input) => {
  return { ...mockStancesOutput, claimId: input.claim.id };
};
