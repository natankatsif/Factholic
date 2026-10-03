import type {
  ClaimId,
  ISODateString,
  LanguageCode,
  SourceId,
  SourceStance,
  VerdictLabel,
} from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { FoundSource } from "../04-source-search/types.ts";

// ===================== ВХОД =====================

export interface VerificationInput {
  claim: Claim;
  sources: FoundSource[];
  /** Окружающий текст из видео (±30 с) — чтобы не вырвать тезис из контекста */
  surroundingText: string;
  /** На каком языке писать summary / explanation */
  uiLanguage: LanguageCode;
}

// ===================== ВЫХОД =====================

export interface SourceAssessment {
  sourceId: SourceId;
  /** Что этот источник говорит про тезис */
  stance: SourceStance;
  /** 0..1 — насколько источник вообще про этот тезис */
  relevance: number;
}

export interface VerificationOutput {
  claimId: ClaimId;
  /** 0..10 целое; null только если label = "unverifiable" */
  score: number | null;
  label: VerdictLabel;
  /** 0..1 */
  confidence: number;
  /** 1 предложение для бейджа, на uiLanguage */
  summary: string;
  /** 2–5 предложений для раскрытой карточки, на uiLanguage */
  explanation: string;
  /** По одной на каждый входной источник */
  sourceAssessments: SourceAssessment[];
  /** Какая модель оценивала — для логов */
  model: string;
  checkedAt: ISODateString;
}
