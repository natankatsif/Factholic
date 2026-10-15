import type { ClaimId } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import { mockClaim, mockDemoClaims } from "../03-claim-extraction/mock.ts";
import { mockSourceSearchOutput } from "../04-source-search/mock.ts";
import { mockProvenanceTree } from "../05-provenance/mock.ts";
import type { SourceAssessment, StancesInput, StancesOutput } from "./types.ts";

export const mockStancesInput: StancesInput = {
  claim: mockClaim,
  sources: mockSourceSearchOutput.sources,
  surroundingText:
    "В Кишинёве после сильного ливня затопило улицу Албишоара, движение транспорта было парализовано на несколько часов.",
  uiLanguage: "ru",
  voteGroups: mockProvenanceTree.voteGroups,
};

/** 2 независимые группы «за»: мэрия (первоисточник) + TV8 (репортаж на месте); 1 mixed */
export const mockStancesOutput: StancesOutput = {
  claimId: mockClaim.id,
  consensus: {
    status: "agree",
    groupsFor: 2,
    groupsAgainst: 0,
    groupsMixed: 1,
    summary: "Мэрия Кишинёва и телеканал TV8 подтверждают затопление улицы Албишоара после сильного ливня.",
    explanation:
      "NewsMaker и Point.md пересказывают сообщение мэрии — это одна группа первоисточника. TV8 вела собственную съёмку на месте — вторая независимая группа «за».",
    authority: "Мэрия Кишинёва",
  },
  sourceAssessments: [
    { sourceId: "src_flood_1", stance: "supports", relevance: 0.95 },
    { sourceId: "src_flood_2", stance: "supports", relevance: 0.9 },
    { sourceId: "src_flood_3", stance: "supports", relevance: 0.85 },
    { sourceId: "src_flood_4", stance: "supports", relevance: 0.9 },
  ],
  model: "mock",
  checkedAt: "2024-09-14T18:00:00Z",
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

const { airport, population, snow, water, flood, gas, schools } = mockDemoClaims;

/**
 * Стороны демо-тезисов на источниках мока 04 и группах голосов из мока 05. Статусы и число групп — такие, какие
 * посчитал бы real.ts по правилам из README (одна группа с официальным первоисточником — вывод по нему).
 */
export const mockDemoStances: Record<ClaimId, Omit<StancesOutput, "model" | "checkedAt">> = {
  [mockClaim.id]: mockStancesOutput,

  [airport.id]: {
    claimId: airport.id,
    consensus: {
      status: "agree",
      groupsFor: 2,
      groupsAgainst: 0,
      groupsMixed: 0,
      summary:
        "Администрация аэропорта и TV8 подтверждают ввод в эксплуатацию автоматических электронных ворот Pax Track.",
      explanation:
        "NewsMaker ссылается на пресс-релиз аэропорта — это одна группа первоисточника. TV8 снял собственный видеосюжет — вторая независимая группа.",
      authority: "Международный аэропорт Кишинёва",
    },
    sourceAssessments: [
      { sourceId: "src_air_1", stance: "supports", relevance: 0.95 },
      { sourceId: "src_air_2", stance: "supports", relevance: 0.9 },
      { sourceId: "src_air_3", stance: "supports", relevance: 0.88 },
    ],
  },

  [population.id]: {
    claimId: population.id,
    consensus: {
      status: "agree",
      groupsFor: 1,
      groupsAgainst: 0,
      groupsMixed: 0,
      summary: "ООН сообщила, что 15 ноября 2022 года население Земли достигло 8 млрд человек.",
      explanation:
        "Reuters, DW и Википедия ссылаются на оценку ООН — это одна группа. Вывод сделан по официальному первоисточнику.",
      authority: "ООН",
    },
    sourceAssessments: [
      { sourceId: "src_pop_1", stance: "supports", relevance: 0.95 },
      { sourceId: "src_pop_2", stance: "supports", relevance: 0.9 },
      { sourceId: "src_pop_3", stance: "supports", relevance: 0.9 },
      { sourceId: "src_pop_4", stance: "supports", relevance: 0.8 },
    ],
  },

  [snow.id]: {
    claimId: snow.id,
    consensus: {
      status: "mostly_against",
      groupsFor: 0,
      groupsAgainst: 2,
      groupsMixed: 0,
      summary:
        "Метеослужба писала о 10 см снега в январе 2021 года; на 1–2 октября 2026 года она прогнозировала погоду без осадков.",
      explanation:
        "Полметра снега «за ночь» есть только в Telegram-канале, который перепечатал новость 2021 года, — это одна группа с метеослужбой и новостями. Прогноз метеослужбы на октябрь — вторая группа.",
    },
    sourceAssessments: [
      { sourceId: "src_snow_1", stance: "refutes", relevance: 0.85 },
      { sourceId: "src_snow_2", stance: "refutes", relevance: 0.8 },
      { sourceId: "src_snow_3", stance: "supports", relevance: 0.9 },
      { sourceId: "src_snow_4", stance: "refutes", relevance: 0.7 },
    ],
  },

  [water.id]: {
    claimId: water.id,
    consensus: {
      status: "mostly_against",
      groupsFor: 0,
      groupsAgainst: 3,
      groupsMixed: 0,
      summary: "Справочники пишут, что 100 °C — температура кипения на уровне моря, а на высоте она ниже.",
      explanation:
        "Википедия, Britannica и Геологическая служба США независимо описывают, как с высотой падает давление, а вместе с ним — температура кипения.",
    },
    sourceAssessments: [
      { sourceId: "src_water_1", stance: "refutes", relevance: 0.9 },
      { sourceId: "src_water_2", stance: "refutes", relevance: 0.9 },
      { sourceId: "src_water_3", stance: "refutes", relevance: 0.85 },
    ],
  },

  [flood.id]: mockStancesOutput,

  [gas.id]: {
    claimId: gas.id,
    consensus: {
      status: "mostly_against",
      groupsFor: 0,
      groupsAgainst: 1,
      groupsMixed: 0,
      summary: "Министерство энергетики сообщило о росте тарифа на газ для населения на 13% с 1 октября.",
      explanation:
        "Все публикации восходят к сообщению министерства — это одна группа, вывод по официальному первоисточнику. 30% встречается только в Telegram-канале.",
      authority: "Министерство энергетики Молдовы",
    },
    sourceAssessments: [
      { sourceId: "src_gas_1", stance: "refutes", relevance: 0.95 },
      { sourceId: "src_gas_2", stance: "refutes", relevance: 0.85 },
      { sourceId: "src_gas_3", stance: "supports", relevance: 0.8 },
    ],
  },

  [schools.id]: {
    claimId: schools.id,
    consensus: {
      status: "few_sources",
      groupsFor: 1,
      groupsAgainst: 0,
      groupsMixed: 0,
      summary: "Нашлась одна публикация — пересказ постов родителей; сообщения мэрии нет.",
      explanation: "Одной группы источников недостаточно для вывода.",
    },
    sourceAssessments: [{ sourceId: "src_sch_1", stance: "supports", relevance: 0.7 }],
  },
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_STANCES=mock) =====================

/** Демо-тезис — его стороны (mockDemoStances); незнакомый — источников в моке нет, «мало источников» */
export const assessStancesMock: Stage<StancesInput, StancesOutput> = async ({ claim, sources }) => {
  const demo = mockDemoStances[claim.id];
  if (demo) return { ...demo, model: "mock", checkedAt: new Date().toISOString() };
  return {
    claimId: claim.id,
    consensus: {
      status: "few_sources",
      groupsFor: 0,
      groupsAgainst: 0,
      groupsMixed: 0,
      summary: "Демо-режим: источники подобраны только для примеров из подсказки.",
      explanation: "Без поиска не с чем сравнить утверждение.",
    },
    sourceAssessments: sources.map((s): SourceAssessment => ({
      sourceId: s.id,
      stance: "neutral",
      relevance: 0,
    })),
    model: "mock",
    checkedAt: new Date().toISOString(),
  };
};
