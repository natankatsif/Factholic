import type { Stage } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { FoundSource, SourceSearchInput, SourceSearchOutput } from "./types.ts";

export const mockSourceSearchInput: SourceSearchInput = {
  claim: mockClaim,
  maxSources: 5,
  searchLanguages: ["ru", "en"],
  videoPublishedAt: "2026-10-02T09:00:00Z",
};

// Ссылки выдуманы
const ohchr: FoundSource = {
  id: "src_05_1",
  url: "https://www.ohchr.org/en/countries/ukraine",
  title: "Ukraine — UN Human Rights Office",
  publisher: "Управление ООН по правам человека",
  domain: "ohchr.org",
  sourceType: "international_org",
  dateFrom: null,
  links: [],
  language: "en",
  excerpt:
    "The Office continues to document civilian casualties resulting from the armed conflict in Ukraine, which escalated with the full-scale armed attack in February 2022…",
  snippet:
    "The Office continues to document civilian casualties resulting from the armed conflict in Ukraine.",
  domainReliability: 0.95,
  retrievedAt: "2026-10-03T10:01:50Z",
};

const reuters: FoundSource = {
  id: "src_05_2",
  url: "https://www.reuters.com/world/europe/",
  title: "Ukraine war latest",
  publisher: "Reuters",
  domain: "reuters.com",
  sourceType: "news",
  publishedAt: "2026-10-02T08:00:00Z",
  dateFrom: "search",
  links: [],
  language: "en",
  country: "GB",
  excerpt:
    "Fighting continued along the front line overnight, officials said, as both sides reported drone attacks…",
  snippet: "Fighting continued along the front line overnight, officials said.",
  domainReliability: 0.92,
  retrievedAt: "2026-10-03T10:01:51Z",
};

const dw: FoundSource = {
  id: "src_05_3",
  url: "https://www.dw.com/ru/",
  title: "Война в Украине: главное за сутки",
  publisher: "Deutsche Welle",
  domain: "dw.com",
  sourceType: "news",
  publishedAt: "2026-10-02T18:00:00Z",
  dateFrom: "page",
  // «по данным Reuters» — ссылка на родителя в дереве
  links: ["https://www.reuters.com/world/europe/"],
  language: "ru",
  country: "DE",
  excerpt:
    "Боевые действия продолжаются на нескольких направлениях, сообщают военные обеих сторон, передаёт Reuters…",
  snippet: "Боевые действия продолжаются на нескольких направлениях.",
  domainReliability: 0.88,
  retrievedAt: "2026-10-03T10:01:51Z",
};

const wikipedia: FoundSource = {
  id: "src_05_4",
  url: "https://ru.wikipedia.org/wiki/Вторжение_России_в_Украину",
  title: "Вторжение России в Украину (с 2022) — Википедия",
  publisher: "Википедия",
  domain: "ru.wikipedia.org",
  sourceType: "encyclopedia",
  dateFrom: null,
  links: [],
  language: "ru",
  excerpt: "Военные действия начались 24 февраля 2022 года…",
  snippet: "Военные действия начались 24 февраля 2022 года.",
  domainReliability: 0.8,
  retrievedAt: "2026-10-03T10:01:52Z",
};

/** Перепечатка DW молдавским сайтом — в `sources` не попала (издатель «повторяет» DW), но нужна дереву */
const reprint: FoundSource = {
  id: "src_05_5",
  url: "https://point.md/ru/novosti/v-mire/voina-v-ukraine-glavnoe",
  title: "Война в Украине: главное за сутки",
  publisher: "Point.md",
  domain: "point.md",
  sourceType: "news",
  publishedAt: "2026-10-02T19:30:00Z",
  dateFrom: "url",
  links: ["https://www.dw.com/ru/"],
  language: "ru",
  country: "MD",
  excerpt: "Боевые действия продолжаются на нескольких направлениях, сообщает DW со ссылкой на Reuters…",
  snippet: "Боевые действия продолжаются на нескольких направлениях, сообщает DW.",
  domainReliability: 0.5,
  retrievedAt: "2026-10-03T10:01:53Z",
};

export const mockSourceSearchOutput: SourceSearchOutput = {
  claimId: "clm_05",
  queries: [
    { text: "война в Украине", language: "ru", engine: "tavily", intent: "confirm" },
    { text: "războiul din Ucraina", language: "ro", engine: "tavily", intent: "context" },
    { text: "war in Ukraine latest UN", language: "en", engine: "tavily", intent: "confirm" },
    { text: "Ukraine war fact check", language: "en", engine: "tavily", intent: "refute" },
    { text: "война в Украине впервые сообщили", language: "ru", engine: "tavily", intent: "earliest" },
    { text: "Ukraine war", language: "en", engine: "factcheck_api", intent: "refute" },
  ],
  sources: [ohchr, reuters, dw, wikipedia],
  // все страницы по теме, по дате (без даты — в конце)
  copies: [reuters, dw, reprint, ohchr, wikipedia],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_SOURCE_SEARCH=mock) =====================

export const searchSourcesMock: Stage<SourceSearchInput, SourceSearchOutput> = async (input) => {
  return { ...mockSourceSearchOutput, claimId: input.claim.id };
};
