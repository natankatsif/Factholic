import type { ClaimId, ISODateString, LanguageCode, SourceId, SourceType } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";

// ===================== ВХОД =====================

export interface SourceSearchInput {
  claim: Claim;
  /** Сколько источников вернуть максимум (рекомендуется 3–6) */
  maxSources: number;
  /** На каких языках искать: язык видео + "en" как минимум (для дерева — ещё ro, ru) */
  searchLanguages: LanguageCode[];
  /** Дата публикации видео: самое раннее упоминание ищем ДО неё (запрос intent "earliest"). TODO backend-1 */
  videoPublishedAt?: ISODateString;
}

// ===================== ВЫХОД =====================

/**
 * confirm  — подтверждение (первоисточники данных)
 * refute   — опровержение, разборы фактчекеров
 * context  — общая картина по теме
 * earliest — самое раннее упоминание (с ограничением по дате) — корень дерева
 */
export type QueryIntent = "confirm" | "refute" | "context" | "earliest";

export interface SearchQuery {
  text: string;
  language: LanguageCode;
  /** "tavily" | "brave" | "google" | "factcheck_api" ... */
  engine: string;
  intent?: QueryIntent;
}

export interface FoundSource {
  id: SourceId;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  sourceType: SourceType;
  /** Дата публикации — сырьё для дерева первоисточника (сортировка, корень, старый контент) */
  publishedAt?: ISODateString;
  /** Откуда дата: из выдачи поиска, из разметки страницы (meta, JSON-LD), из URL. TODO backend-1 */
  dateFrom?: "search" | "page" | "url" | null;
  /** Ссылки из текста страницы (абсолютные URL) — явные рёбра дерева «кто у кого взял». TODO backend-1 */
  links?: string[];
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
  /** Для «сторон» (этап 08): разнообразная выборка — разные издатели, типы, страны, языки */
  sources: FoundSource[];
  /**
   * Для дерева (этап 05): ВСЕ страницы по теме, без отбора по издателю — все перепечатки одной новости.
   * Включает и `sources` (с теми же id). Нет (TODO backend-1) — дерево строится по `sources`.
   */
  copies?: FoundSource[];
}
