import type { Stage } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { SourceSearchInput, SourceSearchOutput } from "./types.ts";

export const mockSourceSearchInput: SourceSearchInput = {
  claim: mockClaim,
  maxSources: 5,
  searchLanguages: ["ru", "en"],
};

// Ссылки выдуманы
export const mockSourceSearchOutput: SourceSearchOutput = {
  claimId: "clm_05",
  queries: [
    { text: "война в Украине", language: "ru", engine: "tavily" },
    { text: "war in Ukraine latest UN", language: "en", engine: "tavily" },
    { text: "Ukraine war", language: "en", engine: "factcheck_api" },
  ],
  copies: [
    {
      id: "clm_05_c1",
      url: "https://www.example-agency.md/2022/02/24/razboi-in-ucraina",
      title: "Rusia a declanșat războiul în Ucraina",
      publisher: "Agenția MD (пример)",
      domain: "example-agency.md",
      sourceType: "news",
      language: "ro",
      publishedAt: "2022-02-24T05:00:00.000Z",
      dateSource: "url",
      excerpt: "Rusia a declanșat în această dimineață războiul în Ucraina, potrivit președintelui Zelenski…",
      outboundLinks: ["https://www.president.gov.ua/news/123"],
      attributions: ["potrivit președintelui Zelenski"],
      earliestSearch: true,
      retrievedAt: "2026-10-03T10:01:50Z",
    },
    {
      id: "clm_05_c2",
      url: "https://www.example-news.md/ru/voina-v-ukraine-prodolzhaetsya",
      title: "Война в Украине продолжается",
      publisher: "Новости MD (пример)",
      domain: "example-news.md",
      sourceType: "news",
      language: "ru",
      publishedAt: "2026-10-02T08:00:00.000Z",
      dateSource: "search",
      excerpt: "Война в Украине продолжается, по данным Генштаба, бои идут на нескольких направлениях…",
      outboundLinks: [],
      attributions: ["по данным Генштаба"],
      earliestSearch: false,
      retrievedAt: "2026-10-03T10:01:50Z",
    },
  ],
  sources: [
    {
      id: "src_05_1",
      url: "https://www.ohchr.org/en/countries/ukraine",
      title: "Ukraine — UN Human Rights Office",
      publisher: "Управление ООН по правам человека",
      domain: "ohchr.org",
      sourceType: "international_org",
      language: "en",
      excerpt:
        "The Office continues to document civilian casualties resulting from the armed conflict in Ukraine, which escalated with the full-scale armed attack in February 2022…",
      snippet:
        "The Office continues to document civilian casualties resulting from the armed conflict in Ukraine.",
      domainReliability: 0.95,
      retrievedAt: "2026-10-03T10:01:50Z",
    },
    {
      id: "src_05_2",
      url: "https://www.reuters.com/world/europe/",
      title: "Ukraine war latest",
      publisher: "Reuters",
      domain: "reuters.com",
      sourceType: "news",
      publishedAt: "2026-10-02T08:00:00Z",
      language: "en",
      country: "GB",
      excerpt:
        "Fighting continued along the front line overnight, officials said, as both sides reported drone attacks…",
      snippet: "Fighting continued along the front line overnight, officials said.",
      domainReliability: 0.92,
      retrievedAt: "2026-10-03T10:01:51Z",
    },
    {
      id: "src_05_3",
      url: "https://www.dw.com/ru/",
      title: "Война в Украине: главное за сутки",
      publisher: "Deutsche Welle",
      domain: "dw.com",
      sourceType: "news",
      publishedAt: "2026-10-02T18:00:00Z",
      language: "ru",
      country: "DE",
      excerpt: "Боевые действия продолжаются на нескольких направлениях, сообщают военные обеих сторон…",
      snippet: "Боевые действия продолжаются на нескольких направлениях.",
      domainReliability: 0.88,
      retrievedAt: "2026-10-03T10:01:51Z",
    },
    {
      id: "src_05_4",
      url: "https://ru.wikipedia.org/wiki/Вторжение_России_в_Украину",
      title: "Вторжение России в Украину (с 2022) — Википедия",
      publisher: "Википедия",
      domain: "ru.wikipedia.org",
      sourceType: "encyclopedia",
      language: "ru",
      excerpt: "Военные действия начались 24 февраля 2022 года…",
      snippet: "Военные действия начались 24 февраля 2022 года.",
      domainReliability: 0.8,
      retrievedAt: "2026-10-03T10:01:52Z",
    },
  ],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_SOURCE_SEARCH=mock) =====================

export const searchSourcesMock: Stage<SourceSearchInput, SourceSearchOutput> = async (input) => {
  return { ...mockSourceSearchOutput, claimId: input.claim.id };
};
