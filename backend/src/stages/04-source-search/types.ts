import type { ClaimId, ISODateString, LanguageCode, SourceId, SourceType } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";

// ===================== ВХОД =====================

export interface SourceSearchInput {
  claim: Claim;
  /** Сколько источников вернуть максимум (рекомендуется 3–6) */
  maxSources: number;
  /** На каких языках искать: язык видео + "en" как минимум */
  searchLanguages: LanguageCode[];
}

// ===================== ВЫХОД =====================

export interface SearchQuery {
  text: string;
  language: LanguageCode;
  /** "tavily" | "brave" | "google" | "factcheck_api" ... */
  engine: string;
}

export interface FoundSource {
  id: SourceId;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  sourceType: SourceType;
  publishedAt?: ISODateString;
  language: LanguageCode;
  /** Страна издателя, ISO 3166-1 alpha-2 */
  country?: string;
  /**
   * Релевантный кусок текста страницы (до ~2000 символов) — его читает LLM на этапе 05.
   * Во фронт НЕ уходит.
   */
  excerpt: string;
  /** Короткая цитата 1–2 предложения для карточки во фронте */
  snippet: string;
  /** 0..1 — репутация домена (из своего списка / MBFC и т.п.) */
  domainReliability: number;
  retrievedAt: ISODateString;
}

export interface SourceSearchOutput {
  claimId: ClaimId;
  /** Какие запросы делали — для дебага и логов */
  queries: SearchQuery[];
  sources: FoundSource[];
}
