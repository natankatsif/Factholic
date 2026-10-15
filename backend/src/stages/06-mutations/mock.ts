import type { ClaimId } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import { mockClaim, mockDemoClaims } from "../03-claim-extraction/mock.ts";
import { mockProvenanceTree } from "../05-provenance/mock.ts";
import { VIDEO_NODE_ID } from "../05-provenance/types.ts";
import type { ClaimMutation, MutationsInput, MutationsOutput } from "./types.ts";

export const mockMutationsInput: MutationsInput = {
  claim: mockClaim,
  tree: mockProvenanceTree,
  uiLanguage: "ru",
};

/**
 * В дереве тезиса про войну перепечатывали точно — мутаций нет.
 * Пример с раздутыми цифрами и старой датой — снегопад в mockDemoMutations ниже.
 */
export const mockMutationsOutput: MutationsOutput = {
  claimId: mockClaim.id,
  mutations: [
    {
      fromId: "src_flood_2",
      toId: "src_flood_3",
      field: "attribution",
      before: "мэрия Кишинёва",
      after: "без ссылки",
      direction: "removed",
      note: "Ссылка на мэрию пропала",
    },
    {
      fromId: "src_flood_2",
      toId: "src_flood_3",
      field: "certainty",
      before: "движение затруднено",
      after: "движение парализовано",
      direction: "inflated",
      note: "Затруднение движения подано как полная парализация",
    },
  ],
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

const { snow, flood, gas, schools } = mockDemoClaims;

/**
 * Мутации демо-деревьев (mockDemoTrees из мока 05): по рёбрам и по пути корень → материал ("video").
 * Флаги карточки этап 09 строит только из мутаций с toId "video". Тезисов без мутаций здесь нет.
 */
export const mockDemoMutations: Record<ClaimId, ClaimMutation[]> = {
  [mockClaim.id]: mockMutationsOutput.mutations,

  [snow.id]: [
    {
      fromId: "src_snow_1",
      toId: "src_snow_2",
      field: "numbers",
      before: "10 см",
      after: "30 см",
      direction: "inflated",
      note: "Высота снега выросла втрое",
    },
    {
      fromId: "src_snow_2",
      toId: "src_snow_3",
      field: "numbers",
      before: "30 см",
      after: "полметра",
      direction: "inflated",
      note: "30 см превратились в полметра",
    },
    {
      fromId: "src_snow_2",
      toId: "src_snow_3",
      field: "time",
      before: "14 января 2021",
      after: "этой ночью",
      direction: "shifted",
      note: "Снегопад января 2021 года подан как сегодняшний",
    },
    {
      fromId: "src_snow_2",
      toId: "src_snow_3",
      field: "attribution",
      before: "синоптики",
      after: "без ссылки",
      direction: "removed",
      note: "Ссылка на синоптиков пропала",
    },
    {
      fromId: "src_snow_1",
      toId: VIDEO_NODE_ID,
      field: "numbers",
      before: "10 см",
      after: "полметра",
      direction: "inflated",
      note: "Высота снега выросла в пять раз",
    },
    {
      fromId: "src_snow_1",
      toId: VIDEO_NODE_ID,
      field: "time",
      before: "14 января 2021",
      after: "вчера",
      direction: "shifted",
      note: "Событие января 2021 года подано как вчерашнее",
    },
  ],

  [flood.id]: mockMutationsOutput.mutations,

  [gas.id]: [
    {
      fromId: "src_gas_1",
      toId: "src_gas_3",
      field: "numbers",
      before: "13%",
      after: "30%",
      direction: "inflated",
      note: "Рост тарифа завышен более чем вдвое",
    },
    {
      fromId: "src_gas_3",
      toId: VIDEO_NODE_ID,
      field: "attribution",
      before: "Министерство энергетики",
      after: "без ссылки",
      direction: "removed",
      note: "Ссылка на министерство пропала",
    },
    {
      fromId: "src_gas_1",
      toId: VIDEO_NODE_ID,
      field: "numbers",
      before: "13%",
      after: "30%",
      direction: "inflated",
      note: "Рост тарифа завышен более чем вдвое",
    },
  ],

  [schools.id]: [
    {
      fromId: "src_sch_1",
      toId: VIDEO_NODE_ID,
      field: "attribution",
      before: "родители в соцсетях",
      after: "без ссылки",
      direction: "removed",
      note: "Пересказ постов родителей подан как решение мэрии",
    },
  ],
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_MUTATIONS=mock) =====================

export const findMutationsMock: Stage<MutationsInput, MutationsOutput> = async ({ claim }) => {
  return { claimId: claim.id, mutations: mockDemoMutations[claim.id] ?? [] };
};
