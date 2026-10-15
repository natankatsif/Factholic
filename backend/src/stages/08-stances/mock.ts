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
    "Давайте немного о том, что происходит в мире. В Украине сейчас идёт война, и это, конечно, влияет на цены на всё.",
  uiLanguage: "ru",
  voteGroups: mockProvenanceTree.voteGroups,
};

/** 3 источника «за», но DW пересказывает Reuters — независимых групп «за» две; Википедия — mixed */
export const mockStancesOutput: StancesOutput = {
  claimId: "clm_05",
  consensus: {
    status: "agree",
    groupsFor: 2,
    groupsAgainst: 0,
    groupsMixed: 1,
    summary: "ООН, Reuters и Deutsche Welle сообщают о продолжающихся боевых действиях.",
    explanation:
      "Сообщение DW основано на данных Reuters, поэтому они считаются одной группой. Вместе с ООН — две независимые группы «за»; Википедия подтверждает только начало войны в 2022 году.",
  },
  sourceAssessments: [
    { sourceId: "src_05_1", stance: "supports", relevance: 0.95 },
    { sourceId: "src_05_2", stance: "supports", relevance: 0.9 },
    { sourceId: "src_05_3", stance: "supports", relevance: 0.9 },
    { sourceId: "src_05_4", stance: "mixed", relevance: 0.6 },
  ],
  model: "mock",
  checkedAt: "2026-10-03T10:02:05Z",
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

const { war2023, population, snow, water, flood, gas, schools } = mockDemoClaims;

/**
 * Стороны демо-тезисов на источниках мока 04 и группах голосов из мока 05. Статусы и число групп — такие, какие
 * посчитал бы real.ts по правилам из README (одна группа с официальным первоисточником — вывод по нему).
 */
export const mockDemoStances: Record<ClaimId, Omit<StancesOutput, "model" | "checkedAt">> = {
  [mockClaim.id]: mockStancesOutput,

  [war2023.id]: {
    claimId: war2023.id,
    consensus: {
      status: "mostly_against",
      groupsFor: 0,
      groupsAgainst: 3,
      groupsMixed: 0,
      summary: "Источники датируют начало полномасштабного вторжения 24 февраля 2022 года.",
      explanation:
        "DW пересказывает Reuters — это одна группа. Вместе с ООН и Википедией — три независимые группы, и все называют февраль 2022 года; Википедия добавляет, что вооружённый конфликт на востоке Украины идёт с 2014 года.",
    },
    sourceAssessments: [
      { sourceId: "src_w23_1", stance: "refutes", relevance: 0.9 },
      { sourceId: "src_w23_2", stance: "refutes", relevance: 0.95 },
      { sourceId: "src_w23_3", stance: "refutes", relevance: 0.8 },
      { sourceId: "src_w23_4", stance: "refutes", relevance: 0.9 },
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

  [flood.id]: {
    claimId: flood.id,
    consensus: {
      status: "agree",
      groupsFor: 2,
      groupsAgainst: 0,
      groupsMixed: 0,
      summary: "Мэрия и телеканал сообщают о подтоплении улицы Албишоара после ливня.",
      explanation:
        "Новости и портал пересказывают сообщение мэрии — это одна группа. Телеканал снимал на месте сам — вторая. Мэрия пишет, что движение затруднено.",
    },
    sourceAssessments: [
      { sourceId: "src_flood_1", stance: "supports", relevance: 0.9 },
      { sourceId: "src_flood_2", stance: "supports", relevance: 0.85 },
      { sourceId: "src_flood_3", stance: "supports", relevance: 0.85 },
      { sourceId: "src_flood_4", stance: "supports", relevance: 0.8 },
    ],
  },

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
      authority: "Министерство энергетики (пример)",
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
