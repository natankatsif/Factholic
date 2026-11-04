import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FoundSource, SourceCopy } from "../04-source-search/types.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import type { TreeNode } from "./types.ts";
import { copiesForTree, copiesFromSources, voteGroupsForSources, votersFromTree } from "./copies.ts";
import type { ProvenanceTree } from "./types.ts";

const source = (id: string, url: string): FoundSource => ({
  id,
  url,
  title: id,
  publisher: id,
  domain: new URL(url).hostname,
  sourceType: "news",
  language: "ru",
  excerpt: "",
  snippet: "",
  domainReliability: 0.5,
  retrievedAt: "2026-10-03T00:00:00Z",
});

describe("voteGroupsForSources", () => {
  it("копии и источники с разными id сопоставляются по URL: перепечатки — одна группа", () => {
    const sources = [
      source("s1", "https://www.dw.com/ru/a/"),
      source("s2", "https://point.md/b?utm_source=x"),
    ];
    const copies: SourceCopy[] = [
      ...copiesFromSources([source("c1", "https://reuters.com/x")]),
      ...copiesFromSources([source("c2", "https://dw.com/ru/a")]),
      ...copiesFromSources([source("c3", "https://point.md/b")]),
    ];
    const tree = { voteGroups: { c1: "c1", c2: "c1", c3: "c1" } } as unknown as ProvenanceTree;
    assert.deepEqual(voteGroupsForSources(tree, copies, sources), { s1: "c1", s2: "c1" });
  });

  it("источник без копии — сам себе группа; совпадение id тоже работает", () => {
    const sources = [source("s1", "https://a.md/x"), source("c9", "https://b.md/y")];
    const tree = { voteGroups: { c9: "c1" } } as unknown as ProvenanceTree;
    assert.deepEqual(voteGroupsForSources(tree, [], sources), { s1: "s1", c9: "c1" });
  });
});

describe("copiesForTree", () => {
  const sources = [source("s1", "https://www.dw.com/ru/a/"), source("s2", "https://point.md/b")];

  it("копий нет (пусто или undefined) — дерево по источникам", () => {
    assert.deepEqual(copiesForTree([], sources), copiesFromSources(sources));
    assert.deepEqual(copiesForTree(undefined, sources), copiesFromSources(sources));
  });

  it("добирает только источники, которых нет среди копий (по URL)", () => {
    const copies = copiesFromSources([source("c1", "https://dw.com/ru/a")]);
    assert.deepEqual(
      copiesForTree(copies, sources).map((c) => c.id),
      ["c1", "s2"],
    );
  });
});

describe("votersFromTree", () => {
  const structure: ClaimStructure = {
    event: "",
    numbers: [],
    places: [],
    time: null,
    certainty: "asserted",
    certaintyMarkers: [],
    attributedTo: null,
  };
  const voter = { snippet: "", domainReliability: 0.7 };
  const copyOf = (id: string) => ({ ...copiesFromSources([source(id, `https://${id}.md/news`)])[0]!, voter });
  const node = (id: string, relation?: "repeats" | "mentions"): TreeNode => ({
    id,
    url: `https://${id}.md/news`,
    title: id,
    publisher: id,
    domain: `${id}.md`,
    parentId: null,
    via: null,
    confidence: null,
    structure,
    relation,
  });

  it("от каждой независимой ветки голосует одна публикация", () => {
    const copies = [copyOf("root"), copyOf("reprint"), copyOf("other")];
    const tree = {
      claimId: "c",
      rootId: "root",
      nodes: [node("root"), node("reprint"), node("other")],
      voteGroups: { root: "root", reprint: "root", other: "other" },
    };
    assert.deepEqual(
      votersFromTree(tree, copies, []).map((s) => s.id),
      ["root", "other"],
    );
  });

  it("упоминание и уже взятый источник не голосуют", () => {
    const copies = [copyOf("taken"), copyOf("side")];
    const tree = {
      claimId: "c",
      rootId: null,
      nodes: [node("taken"), node("side", "mentions")],
      voteGroups: { taken: "taken", side: "side" },
    };
    assert.deepEqual(votersFromTree(tree, copies, [source("taken", "https://taken.md/news")]), []);
  });

  it("соблюдает потолок: каждый источник — это текст в запросе к основной модели", () => {
    const copies = [copyOf("a"), copyOf("b")];
    const tree = {
      claimId: "c",
      rootId: null,
      nodes: [node("a"), node("b")],
      voteGroups: { a: "a", b: "b" },
    };
    assert.equal(votersFromTree(tree, copies, [], 1).length, 1);
  });
});
