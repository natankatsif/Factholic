import type { Stage } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import { mockProvenanceTree } from "../05-provenance/mock.ts";
import type { MutationsInput, MutationsOutput } from "./types.ts";

export const mockMutationsInput: MutationsInput = {
  claim: mockClaim,
  tree: mockProvenanceTree,
  uiLanguage: "ru",
};

/**
 * В дереве тезиса про войну перепечатывали точно — мутаций нет.
 * Пример с раздутыми цифрами и старой датой — clm_09 в packages/contracts/src/mocks/video-report.mock.ts.
 */
export const mockMutationsOutput: MutationsOutput = {
  claimId: "clm_05",
  mutations: [],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_MUTATIONS=mock) =====================

export const findMutationsMock: Stage<MutationsInput, MutationsOutput> = async (input) => {
  return { ...mockMutationsOutput, claimId: input.claim.id };
};
