import type { ClaimId, SourceId } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import { mockClaim, mockDemoClaims } from "../03-claim-extraction/mock.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import { mockDemoSearch, mockSourceSearchOutput } from "../04-source-search/mock.ts";
import { copiesFromSources } from "./copies.ts";
import { domainOf, VIDEO_PUBLISHER } from "./tree.ts";
import {
  VIDEO_NODE_ID,
  type ProvenanceInput,
  type ProvenanceTree,
  type ProvenanceVia,
  type TreeNode,
} from "./types.ts";

export const mockProvenanceInput: ProvenanceInput = {
  claim: mockClaim,
  // как в оркестраторе: copies из 04, у старых моков их нет — источники как копии
  copies: mockSourceSearchOutput.copies ?? copiesFromSources(mockSourceSearchOutput.sources),
  video: {
    url: "https://www.youtube.com/watch?v=MOCK123",
    title: "Большое интервью: экономика, наука и мировые события",
    publishedAt: "2026-10-02T09:00:00Z",
  },
};

// в моке этапа 03 структура заполнена (в типе она необязательная — ради старых моков)
const sameClaim: ClaimStructure = mockClaim.structure!;

/**
 * Пример выхода на источниках 04 (src_05_*): Reuters (корень) ← DW (ссылка на Reuters) ← Point.md (ссылка на DW);
 * видео — вероятно, пересказ DW. ООН и Википедия без дат и без связей — отдельные ветки (и отдельные голоса
 * в «сторонах»). На id и датах этого дерева построены моки 06–09 — меняй вместе с ними.
 */
export const mockProvenanceTree: ProvenanceTree = {
  claimId: "clm_05",
  rootId: "src_05_2",
  nodes: [
    {
      id: "src_05_2",
      url: "https://www.reuters.com/world/europe/",
      title: "Ukraine war latest",
      publisher: "Reuters",
      domain: "reuters.com",
      publishedAt: "2026-10-02T08:00:00Z",
      parentId: null,
      via: null,
      confidence: null,
      structure: sameClaim,
    },
    {
      id: "src_05_3",
      url: "https://www.dw.com/ru/",
      title: "Война в Украине: главное за сутки",
      publisher: "Deutsche Welle",
      domain: "dw.com",
      publishedAt: "2026-10-02T18:00:00Z",
      parentId: "src_05_2",
      via: "link",
      confidence: "confirmed",
      structure: {
        ...sameClaim,
        certainty: "reported",
        certaintyMarkers: ["по данным Reuters"],
        attributedTo: "Reuters",
      },
    },
    {
      id: "src_05_5",
      url: "https://point.md/ru/novosti/v-mire/voina-v-ukraine-glavnoe",
      title: "Война в Украине: главное за сутки",
      publisher: "Point.md",
      domain: "point.md",
      publishedAt: "2026-10-02T19:30:00Z",
      parentId: "src_05_3",
      via: "link",
      confidence: "confirmed",
      structure: {
        ...sameClaim,
        certainty: "reported",
        certaintyMarkers: ["как сообщает DW"],
        attributedTo: "DW",
      },
    },
    {
      id: "src_05_1",
      url: "https://www.ohchr.org/en/countries/ukraine",
      title: "Ukraine — UN Human Rights Office",
      publisher: "Управление ООН по правам человека",
      domain: "ohchr.org",
      parentId: null,
      via: null,
      confidence: null,
      structure: sameClaim,
    },
    {
      id: "src_05_4",
      url: "https://ru.wikipedia.org/wiki/Вторжение_России_в_Украину",
      title: "Вторжение России в Украину (с 2022) — Википедия",
      publisher: "Википедия",
      domain: "ru.wikipedia.org",
      parentId: null,
      via: null,
      confidence: null,
      // о начале войны, а не о том, что она идёт сейчас
      structure: {
        ...sameClaim,
        event: "начало войны в Украине",
        time: { text: "24 февраля 2022 года", date: "2022-02-24", relative: false },
      },
    },
    {
      id: VIDEO_NODE_ID,
      url: "https://www.youtube.com/watch?v=MOCK123",
      title: "Большое интервью: экономика, наука и мировые события",
      publisher: "Это видео",
      domain: "youtube.com",
      publishedAt: "2026-10-02T09:00:00Z",
      parentId: "src_05_3",
      via: "duplicate",
      confidence: "probable",
      structure: sameClaim,
    },
  ],
  voteGroups: {
    src_05_1: "src_05_1",
    src_05_2: "src_05_2",
    src_05_3: "src_05_2",
    src_05_4: "src_05_4",
    src_05_5: "src_05_2",
  },
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

const { war2023, population, snow, water, flood, gas, schools } = mockDemoClaims;
const demoSources = new Map(
  Object.values(mockDemoSearch)
    .flatMap((s) => s.sources)
    .map((s) => [s.id, s]),
);

/** Узел из источника мока 04: ссылка — confirmed, «по данным» и дубль текста — probable */
function node(
  id: SourceId,
  parentId: SourceId | null,
  via: ProvenanceVia | null,
  structure: ClaimStructure | null,
): TreeNode {
  const s = demoSources.get(id)!;
  return {
    id,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    domain: s.domain,
    ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}),
    parentId,
    via,
    confidence: via === null ? null : via === "link" ? "confirmed" : "probable",
    structure,
  };
}

/** Узел самого материала: адрес, название и дату подставляет buildProvenanceTreeMock */
function videoNode(parentId: SourceId | null, structure: ClaimStructure | null): TreeNode {
  return {
    id: VIDEO_NODE_ID,
    url: "",
    title: "",
    publisher: VIDEO_PUBLISHER,
    domain: "",
    parentId,
    via: parentId === null ? null : "duplicate",
    confidence: parentId === null ? null : "probable",
    structure,
  };
}

/** «Со ссылкой на X»: как утверждение подано в перепечатке */
function reported(structure: ClaimStructure, marker: string, attributedTo: string): ClaimStructure {
  return { ...structure, certainty: "reported", certaintyMarkers: [marker], attributedTo };
}

const war2023Root: ClaimStructure = {
  ...war2023.structure,
  event: "начало полномасштабного вторжения России в Украину",
  time: { text: "24 февраля 2022 года", date: "2022-02-24", relative: false },
};
const populationRoot: ClaimStructure = {
  ...population.structure,
  time: { text: "15 ноября 2022 года", date: "2022-11-15", relative: false },
};
const snowRoot: ClaimStructure = {
  ...snow.structure,
  numbers: [{ value: "10 см", about: "снега за ночь" }],
  time: { text: "в ночь на 14 января 2021 года", date: "2021-01-14", relative: false },
};
const waterSource: ClaimStructure = {
  ...water.structure,
  numbers: [{ value: "100 °C", about: "температура кипения воды на уровне моря" }],
  places: ["на уровне моря"],
};
const gasRoot: ClaimStructure = {
  ...gas.structure,
  numbers: [{ value: "13%", about: "рост тарифа на газ" }],
};

/**
 * Деревья демо-тезисов на источниках мока 04. На id узлов построены моки 06 (мутации) и 08 (группы голосов).
 * Даты — до MOCK_PUBLISHED_AT (мок 01): от неё этап 07 считает «вчера» тезиса про снег.
 */
export const mockDemoTrees: Record<ClaimId, ProvenanceTree> = {
  [mockClaim.id]: mockProvenanceTree,

  // Reuters ← DW (ссылка); материал сдвигает год — вероятно, пересказ Reuters. ООН и Википедия — отдельные ветки
  [war2023.id]: {
    claimId: war2023.id,
    rootId: "src_w23_2",
    nodes: [
      node("src_w23_2", null, null, war2023Root),
      node("src_w23_4", "src_w23_2", "link", reported(war2023Root, "по данным Reuters", "Reuters")),
      node("src_w23_1", null, null, war2023Root),
      node("src_w23_3", null, null, {
        ...war2023Root,
        time: { text: "в феврале 2022 года", date: "2022-02", relative: false },
      }),
      videoNode("src_w23_2", war2023.structure),
    ],
    voteGroups: {
      src_w23_1: "src_w23_1",
      src_w23_2: "src_w23_2",
      src_w23_3: "src_w23_3",
      src_w23_4: "src_w23_2",
    },
  },

  // ООН — первоисточник, остальные ссылаются на неё: одна группа голосов
  [population.id]: {
    claimId: population.id,
    rootId: "src_pop_1",
    nodes: [
      node("src_pop_1", null, null, populationRoot),
      node("src_pop_2", "src_pop_1", "attribution", reported(populationRoot, "UN says", "ООН")),
      node("src_pop_3", "src_pop_1", "link", reported(populationRoot, "по данным ООН", "ООН")),
      node("src_pop_4", "src_pop_1", "link", reported(populationRoot, "по оценке ООН", "ООН")),
      videoNode("src_pop_3", population.structure),
    ],
    voteGroups: {
      src_pop_1: "src_pop_1",
      src_pop_2: "src_pop_1",
      src_pop_3: "src_pop_1",
      src_pop_4: "src_pop_1",
    },
  },

  // метеослужба (10 см, январь 2021) ← новости (30 см) ← Telegram (полметра, «этой ночью», октябрь 2026) ← видео
  [snow.id]: {
    claimId: snow.id,
    rootId: "src_snow_1",
    nodes: [
      node("src_snow_1", null, null, snowRoot),
      node("src_snow_2", "src_snow_1", "attribution", {
        ...reported(snowRoot, "сообщают синоптики", "синоптики"),
        numbers: [{ value: "30 см", about: "снега за ночь" }],
      }),
      node("src_snow_4", null, null, null),
      node("src_snow_3", "src_snow_2", "duplicate", {
        ...snow.structure,
        time: { text: "этой ночью", date: null, relative: true },
      }),
      videoNode("src_snow_3", snow.structure),
    ],
    voteGroups: {
      src_snow_1: "src_snow_1",
      src_snow_2: "src_snow_1",
      src_snow_3: "src_snow_1",
      src_snow_4: "src_snow_4",
    },
  },

  // справочники без дат и без связей между собой: корня нет, каждый — свой голос
  [water.id]: {
    claimId: water.id,
    rootId: null,
    nodes: [
      node("src_water_1", null, null, waterSource),
      node("src_water_2", null, null, waterSource),
      node("src_water_3", null, null, waterSource),
      videoNode(null, water.structure),
    ],
    voteGroups: { src_water_1: "src_water_1", src_water_2: "src_water_2", src_water_3: "src_water_3" },
  },

  // мэрия ← новости (ссылка) ← портал (дубль, без ссылки на мэрию) ← текст; телеканал снимал сам — своя ветка
  [flood.id]: {
    claimId: flood.id,
    rootId: "src_flood_1",
    nodes: [
      node("src_flood_1", null, null, flood.structure),
      node(
        "src_flood_2",
        "src_flood_1",
        "link",
        reported(flood.structure, "сообщает мэрия", "мэрия Кишинёва"),
      ),
      node("src_flood_3", "src_flood_2", "duplicate", flood.structure),
      node("src_flood_4", null, null, flood.structure),
      videoNode("src_flood_3", flood.structure),
    ],
    voteGroups: {
      src_flood_1: "src_flood_1",
      src_flood_2: "src_flood_1",
      src_flood_3: "src_flood_1",
      src_flood_4: "src_flood_4",
    },
  },

  // министерство (13%) ← новости (ссылка); Telegram ссылается на министерство, но пишет 30% ← текст
  [gas.id]: {
    claimId: gas.id,
    rootId: "src_gas_1",
    nodes: [
      node("src_gas_1", null, null, gasRoot),
      node(
        "src_gas_2",
        "src_gas_1",
        "link",
        reported(gasRoot, "сообщает Министерство энергетики", "Министерство энергетики"),
      ),
      node(
        "src_gas_3",
        "src_gas_1",
        "attribution",
        reported(gas.structure, "по данным министерства", "Министерство энергетики"),
      ),
      videoNode("src_gas_3", gas.structure),
    ],
    voteGroups: { src_gas_1: "src_gas_1", src_gas_2: "src_gas_1", src_gas_3: "src_gas_1" },
  },

  // единственная публикация — пересказ постов родителей
  [schools.id]: {
    claimId: schools.id,
    rootId: "src_sch_1",
    nodes: [
      node(
        "src_sch_1",
        null,
        null,
        reported(schools.structure, "пишут родители в соцсетях", "родители в соцсетях"),
      ),
      videoNode("src_sch_1", schools.structure),
    ],
    voteGroups: { src_sch_1: "src_sch_1" },
  },
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_PROVENANCE=mock) =====================

/** Демо-тезис — его дерево (mockDemoTrees); незнакомый — в дереве только сам материал */
export const buildProvenanceTreeMock: Stage<ProvenanceInput, ProvenanceTree> = async ({ claim, video }) => {
  const self = {
    url: video.url,
    title: video.title,
    domain: domainOf(video.url),
    ...(video.publishedAt ? { publishedAt: video.publishedAt } : {}),
  };
  const tree = mockDemoTrees[claim.id];
  if (!tree) {
    const only: TreeNode = { ...videoNode(null, claim.structure ?? null), ...self };
    return { claimId: claim.id, rootId: null, nodes: [only], voteGroups: {} };
  }
  return {
    ...tree,
    claimId: claim.id,
    nodes: tree.nodes.map((n) => (n.id === VIDEO_NODE_ID ? { ...n, ...self } : n)),
  };
};
