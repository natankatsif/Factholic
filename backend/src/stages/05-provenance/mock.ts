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
    url: "https://www.youtube.com/watch?v=13R5R5nTcsk",
    title: "Новая система в аэропорту Кишинёва и последствия ливня в столице",
    publishedAt: "2024-09-14T19:00:00Z",
  },
};

// в моке этапа 03 структура заполнена (в типе она необязательная — ради старых моков)
const sameClaim: ClaimStructure = mockClaim.structure!;

/**
 * Выход на реальных молдавских источниках 04 (src_flood_*): Мэрия Кишинёва (корень) ← NewsMaker (ссылка на мэрию)
 * ← Point.md (перепечатка, утеряна ссылка); видео — пересказ Point.md. TV8 (съёмочная группа на месте) — отдельная ветка
 * и независимый голос в «сторонах». На id и датах этого дерева построены моки 06–09.
 */
export const mockProvenanceTree: ProvenanceTree = {
  claimId: "clm_flood_01",
  rootId: "src_flood_1",
  nodes: [
    {
      id: "src_flood_1",
      url: "https://chisinau.md/ro/press/interventie-servicii-strada-albisoara",
      title: "Intervenția serviciilor municipale pe strada Albișoara",
      publisher: "Примэрия Кишинёва",
      domain: "chisinau.md",
      publishedAt: "2024-09-14T15:20:00Z",
      parentId: null,
      via: null,
      confidence: null,
      structure: sameClaim,
    },
    {
      id: "src_flood_2",
      url: "https://newsmaker.md/rus/novosti/v-kishineve-iz-za-livnya-zatopilo-ulitsu-albishoara-dvizhenie-zatrudneno/",
      title: "В Кишиневе из-за ливня затопило улицу Албишоара: движение затруднено",
      publisher: "NewsMaker",
      domain: "newsmaker.md",
      publishedAt: "2024-09-14T16:40:00Z",
      parentId: "src_flood_1",
      via: "link",
      confidence: "confirmed",
      structure: {
        ...sameClaim,
        certainty: "reported",
        certaintyMarkers: ["сообщили в мэрии"],
        attributedTo: "Примэрия Кишинёва",
      },
    },
    {
      id: "src_flood_3",
      url: "https://point.md/ru/novosti/obschestvo/v-kishineve-zatopilo-ulitsu-albishoara-dvizhenie-paralizovano/",
      title: "В Кишинёве затопило улицу Албишоара: движение полностью парализовано",
      publisher: "Point.md",
      domain: "point.md",
      publishedAt: "2024-09-14T17:10:00Z",
      parentId: "src_flood_2",
      via: "duplicate",
      confidence: "probable",
      structure: {
        ...sameClaim,
        certainty: "asserted",
        certaintyMarkers: [],
        attributedTo: null,
      },
    },
    {
      id: "src_flood_4",
      url: "https://tv8.md/2024/09/14/video-strada-albisoara-sub-ape-dupa-ploaia-torentiala-masini-blocate-in-chisinau/",
      title: "Strada Albișoara sub ape după ploaia torențială",
      publisher: "TV8",
      domain: "tv8.md",
      publishedAt: "2024-09-14T16:15:00Z",
      parentId: null,
      via: null,
      confidence: null,
      structure: sameClaim,
    },
    {
      id: VIDEO_NODE_ID,
      url: "https://www.youtube.com/watch?v=13R5R5nTcsk",
      title: "Новая система в аэропорту Кишинёва и последствия ливня в столице",
      publisher: "Это видео",
      domain: "youtube.com",
      publishedAt: "2024-09-14T19:00:00Z",
      parentId: "src_flood_3",
      via: "duplicate",
      confidence: "probable",
      structure: sameClaim,
    },
  ],
  voteGroups: {
    src_flood_1: "src_flood_1",
    src_flood_2: "src_flood_1",
    src_flood_3: "src_flood_1",
    src_flood_4: "src_flood_4",
  },
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

const { airport, population, snow, water, flood, gas, schools } = mockDemoClaims;
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
  structure: ClaimStructure | null | undefined,
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
    structure: structure ?? null,
  };
}

/** Узел самого материала: адрес, название и дату подставляет buildProvenanceTreeMock */
function videoNode(parentId: SourceId | null, structure: ClaimStructure | null | undefined): TreeNode {
  return {
    id: VIDEO_NODE_ID,
    url: "",
    title: "",
    publisher: VIDEO_PUBLISHER,
    domain: "",
    parentId,
    via: parentId === null ? null : "duplicate",
    confidence: parentId === null ? null : "probable",
    structure: structure ?? null,
  };
}

/** «Со ссылкой на X»: как утверждение подано в перепечатке */
function reported(structure: ClaimStructure, marker: string, attributedTo: string): ClaimStructure {
  return { ...structure, certainty: "reported", certaintyMarkers: [marker], attributedTo };
}

const airportRoot: ClaimStructure = {
  ...airport.structure,
  event: "запуск электронных ворот в аэропорту Кишинёва",
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

  // Администрация аэропорта ← NewsMaker (ссылка на администрацию); TV8 — самостоятельный репортаж
  [airport.id]: {
    claimId: airport.id,
    rootId: "src_air_1",
    nodes: [
      node("src_air_1", null, null, airportRoot),
      node("src_air_2", null, null, airport.structure),
      node(
        "src_air_3",
        "src_air_1",
        "link",
        reported(airport.structure, "сообщает администрация", "администрация аэропорта"),
      ),
      videoNode("src_air_2", airport.structure),
    ],
    voteGroups: {
      src_air_1: "src_air_1",
      src_air_2: "src_air_2",
      src_air_3: "src_air_1",
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
  [flood.id]: mockProvenanceTree,

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
