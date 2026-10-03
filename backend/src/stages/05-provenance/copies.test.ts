import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FoundSource, SourceCopy } from "../04-source-search/types.ts";
import { copiesForTree, copiesFromSources, voteGroupsForSources } from "./copies.ts";
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
