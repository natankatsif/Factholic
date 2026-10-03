import type { ClaimId, ISODateString, SourceId } from "@news/contracts";
import type { Claim, ClaimStructure } from "../03-claim-extraction/types.ts";
import type { FoundSource } from "../04-source-search/types.ts";

/** id узла самого проверяемого видео в дереве */
export const VIDEO_NODE_ID = "video";

export type ProvenanceVia = "link" | "attribution" | "duplicate";
export type ProvenanceConfidence = "confirmed" | "probable";

// ===================== ВХОД =====================

export interface ProvenanceInput {
  claim: Claim;
  /** Все перепечатки из этапа 04 (`copies`) — с датами, ссылками и текстом */
  copies: FoundSource[];
  /** Само видео — последний узел дерева (id "video") */
  video: { url: string; title: string; publishedAt?: ISODateString };
}

// ===================== ВЫХОД =====================

/** Узел дерева + структура тезиса так, как он подан в этой публикации (по ней этап 06 ищет мутации) */
export interface TreeNode {
  id: SourceId;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  publishedAt?: ISODateString;
  parentId: SourceId | null;
  via: ProvenanceVia | null;
  confidence: ProvenanceConfidence | null;
  /** null — публикация по теме, но самого утверждения в ней нет */
  structure: ClaimStructure | null;
}

export interface ProvenanceTree {
  claimId: ClaimId;
  /** Самый ранний узел без родителя (с датой); null — дат не хватило */
  rootId: SourceId | null;
  /** Отсортированы по publishedAt (без даты — в конце); узел "video" — последний */
  nodes: TreeNode[];
  /**
   * Группы независимости для «сторон» (этап 08): id источника → id корня его ветки.
   * Перепечатки одной новости — одна группа, а не 5 голосов.
   */
  voteGroups: Record<SourceId, string>;
}
