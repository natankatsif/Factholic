/**
 * Эталонные тезисы для eval этапа 04 (прогон — eval/run.ts, см. раздел «Eval» в README этапа).
 *
 * Выдача поиска меняется со временем, поэтому конкретные URL не проверяются — только метрики разнообразия
 * и полноты (см. run.ts). Тезисы — общеизвестные факты и мифы, по которым у поиска заведомо есть материал.
 */
import type { ClaimCategory, LanguageCode, SourceType } from "@news/contracts";
import type { Claim } from "../../03-claim-extraction/types.ts";
import type { SourceSearchInput } from "../types.ts";

export interface SourceSearchCase {
  id: string;
  /** Что проверяет кейс */
  about: string;
  input: SourceSearchInput;
  expect?: {
    /** Минимум источников в выдаче (по умолчанию 3) */
    minSources?: number;
    /** Хотя бы один источник одного из этих типов (первоисточник для статистики, фактчекер для мифа и т.п.) */
    anyOfTypes?: SourceType[];
  };
}

function input(
  c: Pick<Claim, "id" | "quote" | "normalized" | "entities"> & {
    category: ClaimCategory;
    language: LanguageCode;
  },
  searchLanguages: LanguageCode[],
): SourceSearchInput {
  return {
    claim: {
      jobId: "eval",
      range: { start: 600, end: 604.5 },
      checkworthiness: 0.9,
      segmentIds: ["0_0"],
      speaker: "SPEAKER_1",
      ...c,
    },
    maxSources: 5,
    searchLanguages,
  };
}

export const CASES: SourceSearchCase[] = [
  {
    id: "ru-event-war",
    about: "текущее событие на русском: свежие источники разных стран и типов",
    input: input(
      {
        id: "clm_s01",
        quote: "в Украине сейчас идёт война",
        normalized: "На территории Украины идёт война.",
        category: "event",
        language: "ru",
        entities: ["Украина"],
      },
      ["ru", "en"],
    ),
  },
  {
    id: "en-statistic-population",
    about: "statistic: a primary data source (UN / statistics office / research) is expected",
    input: input(
      {
        id: "clm_s02",
        quote: "the world population passed eight billion in November 2022",
        normalized: "The world population exceeded 8 billion people in November 2022.",
        category: "statistic",
        language: "en",
        entities: ["world population", "8 billion", "United Nations"],
      },
      ["en"],
    ),
    expect: { anyOfTypes: ["international_org", "government", "academic"] },
  },
  {
    id: "uk-historical-association",
    about: "історичний факт українською: джерела українською та англійською",
    input: input(
      {
        id: "clm_s03",
        quote: "У 2014 році Україна підписала Угоду про асоціацію з Європейським Союзом",
        normalized: "У 2014 році Україна підписала Угоду про асоціацію з Європейським Союзом.",
        category: "historical",
        language: "uk",
        entities: ["Україна", "Європейський Союз", "Угода про асоціацію"],
      },
      ["uk", "en"],
    ),
    expect: { anyOfTypes: ["international_org", "government", "encyclopedia"] },
  },
  {
    id: "ru-scientific-measles",
    about: "медицинский миф: нужны научные / международные источники или фактчекеры",
    input: input(
      {
        id: "clm_s04",
        quote: "прививка от кори вызывает аутизм, это все знают",
        normalized: "Вакцина против кори (КПК) вызывает аутизм у детей.",
        category: "scientific",
        language: "ru",
        entities: ["вакцина КПК", "корь", "аутизм"],
      },
      ["ru", "en"],
    ),
    expect: { anyOfTypes: ["international_org", "academic", "government", "fact_checker"] },
  },
  {
    id: "en-scientific-great-wall",
    about: "popular myth: debunking sources are expected",
    input: input(
      {
        id: "clm_s05",
        quote: "you can see the Great Wall of China from the Moon with your own eyes",
        normalized: "The Great Wall of China is visible from the Moon with the naked eye.",
        category: "scientific",
        language: "en",
        entities: ["Great Wall of China", "Moon"],
      },
      ["en"],
    ),
    expect: { anyOfTypes: ["fact_checker", "government", "academic", "encyclopedia"] },
  },
  {
    id: "ru-statistic-baikal",
    about: "статистика о природе на русском",
    input: input(
      {
        id: "clm_s06",
        quote: "в Байкале двадцать процентов всей пресной воды планеты",
        normalized: "Озеро Байкал содержит около 20% мировых запасов пресной поверхностной воды.",
        category: "statistic",
        language: "ru",
        entities: ["Байкал", "пресная вода", "20%"],
      },
      ["ru", "en"],
    ),
  },
  {
    id: "en-quote-armstrong",
    about: "quote of a famous person",
    input: input(
      {
        id: "clm_s07",
        quote: "Armstrong said that's one small step for man, one giant leap for mankind",
        normalized:
          'Neil Armstrong said "That\'s one small step for man, one giant leap for mankind" when he stepped onto the Moon in 1969.',
        category: "quote",
        language: "en",
        entities: ["Neil Armstrong", "Apollo 11", "1969"],
      },
      ["en"],
    ),
  },
  {
    id: "uk-statistic-inflation",
    about: "свіжа статистика українською: потрібне офіційне або міжнародне першоджерело",
    input: input(
      {
        id: "clm_s08",
        quote: "інфляція торік була дванадцять відсотків",
        normalized: "Інфляція в Україні у 2024 році становила 12%.",
        category: "statistic",
        language: "uk",
        entities: ["Україна", "інфляція", "2024"],
      },
      ["uk", "en"],
    ),
    expect: { anyOfTypes: ["government", "international_org"] },
  },
];
