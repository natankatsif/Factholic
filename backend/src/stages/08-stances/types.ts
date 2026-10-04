import type { ClaimId, ISODateString, LanguageCode, SourceId, SourceStance } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { FoundSource } from "../04-source-search/types.ts";

export type ConsensusStatus = "agree" | "split" | "mostly_against" | "few_sources";

export interface Consensus {
  status: ConsensusStatus;
  groupsFor: number;
  groupsAgainst: number;
  /** Группы, где «за» и «против» уравновесились (или все источники — «частично»): голос делится пополам */
  groupsMixed: number;
  summary: string;
  explanation: string;
  /**
   * Вывод сделан по одному официальному первоисточнику (все остальные — его перепечатки):
   * имя источника — «ООН», «Biroul Național de Statistică». Нет — вывод по нескольким независимым группам.
   */
  authority?: string;
}

// ===================== ВХОД =====================

export interface StancesInput {
  claim: Claim;
  /** Разнообразная выборка из этапа 04 (`sources`) */
  sources: FoundSource[];
  /** Окружающий текст из видео (±30 с) — чтобы не вырвать тезис из контекста */
  surroundingText: string;
  /** На каком языке писать summary / explanation */
  uiLanguage: LanguageCode;
  /**
   * Группы независимости из дерева (этап 05): id источника → id группы.
   * Перепечатки одной новости — один голос. Нет (дерево не построено) — каждый источник сам по себе.
   */
  voteGroups?: Record<SourceId, string>;
}

// ===================== ВЫХОД =====================

export interface SourceAssessment {
  sourceId: SourceId;
  /** Что этот источник говорит про тезис */
  stance: SourceStance;
  /** 0..1 — насколько источник вообще про этот тезис */
  relevance: number;
}

export interface StancesOutput {
  claimId: ClaimId;
  /**
   * Стороны вместо вердикта «правда/ложь»: сходятся / разделились / большинство против / мало источников.
   * Статус считает КОД по позициям (вес — domainReliability, перепечатки одной группы — один голос),
   * LLM пишет только описательные summary / explanation.
   */
  consensus: Consensus;
  /** По одной на каждый входной источник */
  sourceAssessments: SourceAssessment[];
  /** Какая модель оценивала позиции — для логов ("rules" — без LLM) */
  model: string;
  checkedAt: ISODateString;
}
