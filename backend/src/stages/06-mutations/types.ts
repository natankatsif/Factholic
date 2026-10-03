import type { ClaimId, LanguageCode } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { ProvenanceTree } from "../05-provenance/types.ts";

export type MutationField = "numbers" | "place" | "time" | "certainty" | "attribution";

export type MutationDirection = "inflated" | "deflated" | "shifted" | "added" | "removed" | "changed";

export interface ClaimMutation {
  fromId: string;
  toId: string;
  field: MutationField;
  before: string;
  after: string;
  direction: MutationDirection;
  note: string;
}

// ===================== ВХОД =====================

export interface MutationsInput {
  claim: Claim;
  /** Дерево из этапа 05: сравниваем structure родителя и потомка вдоль каждого ребра (и путь корень → видео) */
  tree: ProvenanceTree;
  /** На каком языке писать note */
  uiLanguage: LanguageCode;
}

// ===================== ВЫХОД =====================

export interface MutationsOutput {
  claimId: ClaimId;
  /** Изменения по типам: цифры / место / время / уверенность / атрибуция. Пусто — перепечатывали точно */
  mutations: ClaimMutation[];
}
