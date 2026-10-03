import type { Stage } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import { mockSourceSearchOutput } from "../04-source-search/mock.ts";
import { copiesFromSources } from "./copies.ts";
import { VIDEO_NODE_ID, type ProvenanceInput, type ProvenanceTree } from "./types.ts";

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

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_PROVENANCE=mock) =====================

export const buildProvenanceTreeMock: Stage<ProvenanceInput, ProvenanceTree> = async (input) => {
  return { ...mockProvenanceTree, claimId: input.claim.id };
};
