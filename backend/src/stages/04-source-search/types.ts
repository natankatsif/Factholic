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
  /** Разнообразные источники (разные издатели, типы, страны) — для «кто за и кто против» */
  sources: FoundSource[];
  /**
   * ВСЕ найденные публикации об утверждении, включая перепечатки одного издателя, — сырьё для дерева
   * первоисточника. Отсортированы по дате (раньше — первые, без даты — в конце).
   * Real-реализация заполняет всегда; optional — ради старых моков.
   */
  copies?: SourceCopy[];
  /** Как прошёл поиск: сколько раундов, хватило ли данных и чего не хватило. optional — ради старых моков */
  search?: SearchReport;
}

/**
 * Итог «умного» поиска: после каждого раунда код проверяет, хватает ли источников, и если нет —
 * LLM придумывает прицельные запросы (не больше 3 раундов).
 */
export interface SearchReport {
  rounds: number;
  /** Хватило ли данных по всем критериям */
  sufficient: boolean;
  /**
   * Жёсткие пробелы — без них утверждение нельзя ни подтвердить, ни опровергнуть:
   * «никто не называет число 200», «найден только один независимый источник».
   * Не пусто → итог «Недостаточно информации».
   */
  unconfirmed: string[];
  /** Мягкие пробелы — повод искать дальше, но не приговор: «нет официального источника» */
  gaps: string[];
}

/** Одна публикация об утверждении — будущий узел дерева первоисточника */
export interface SourceCopy {
  id: SourceId;
  url: string;
  title: string;
  publisher: string;
  domain: string;
  sourceType: SourceType;
  language: LanguageCode;
  publishedAt?: ISODateString;
  /** Откуда дата: search — поисковик, url — из адреса (/2023/03/14/), page — разметка страницы */
  dateSource?: "search" | "url" | "page";
  /** Кусок текста об утверждении (до ~2000 символов) — по нему backend-2 сравнивает цифры, место, время */
  excerpt: string;
  /** Внешние ссылки из текста (на другие сайты) — кандидаты в «взято отсюда» для рёбер дерева */
  outboundLinks: string[];
  /** Упоминания источника в тексте: «по данным мэрии», «сообщает NewsMaker», «potrivit poliției» */
  attributions: string[];
  /** Найдена запросом «самое раннее упоминание» (поиск по датам до самой старой известной копии) */
  earliestSearch: boolean;
  retrievedAt: ISODateString;
}
