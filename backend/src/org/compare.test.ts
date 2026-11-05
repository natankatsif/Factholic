import assert from "node:assert/strict";
import { test } from "node:test";
import type { FactCheck, ProvenanceNode } from "@news/contracts";
import { compareChecks } from "./compare.ts";

const SINCE = "2026-11-05T10:00:00Z";

const node = (id: string, isoDate?: string): ProvenanceNode => ({
  id,
  name: id,
  category: "media",
  role: "retelling",
  date: isoDate ?? "",
  quote: id,
  url: `https://site.md/${id}`,
  isoDate,
});

const factCheck = (nodes: ProvenanceNode[], extra: Partial<FactCheck> = {}): FactCheck => ({
  id: "fc",
  status: "done",
  range: { start: 0, end: 1 },
  quote: "q",
  claim: "c",
  category: "event",
  consensus: "unverifiable",
  flags: [],
  sources: [],
  provenance: { pathSummary: [], nodes, edges: [] },
  ...extra,
});

const types = (before: FactCheck, after: FactCheck) =>
  compareChecks({ before, after, since: SINCE, days: 1, usualPerDay: 0 }).map((signal) => signal.type);

test("старые статьи, которые поиск нашёл впервые, — не рост (случай из платного прогона)", () => {
  const before = factCheck([node("a")]);
  const after = factCheck([
    node("a"),
    ...["b", "c", "d", "e", "f", "g"].map((id) => node(id, "2026-05-20")),
    node("undated"),
  ]);
  assert.deepEqual(types(before, after), []);
});

test("вышедшее после прошлой проверки — рост", () => {
  const before = factCheck([node("a")]);
  const after = factCheck([node("a"), ...["b", "c", "d", "e", "f"].map((id) => node(id, "2026-11-06"))]);
  assert.deepEqual(types(before, after).sort(), ["growth", "new_publications"]);
});

test("итог изменился, только если изменился сам итог", () => {
  const nodes = [node("a")];
  const same = types(
    factCheck(nodes, { sides: { for: 0, against: 0, mixed: 1 } }),
    factCheck(nodes, { sides: { for: 0, against: 0, mixed: 2 } }),
  );
  assert.deepEqual(same, []);
  assert.deepEqual(types(factCheck(nodes), factCheck(nodes, { consensus: "against" })), ["sides_changed"]);
});

test("старый разбор важен, даже если вышел давно", () => {
  const lab = { ...node("lab", "2025-01-01"), category: "fact_checker" as const };
  assert.deepEqual(types(factCheck([node("a")]), factCheck([node("a"), lab])), ["debunk_found"]);
});
