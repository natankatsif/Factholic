import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_SEARCH_PASSES, mergeCopies, searchUntilFound } from "./deep-search.ts";
import type { PlannedQuery } from "./queries.ts";
import type { SourceCopy } from "./types.ts";

const copy = (url: string, publishedAt?: string) => ({ id: "x", url, publishedAt }) as SourceCopy;
const query = (text: string): PlannedQuery => ({ text, language: "ro", intent: "context", freshness: "any" });

function steps(found: SourceCopy[][], queries = [query("новый")]) {
  const calls = { plan: 0, run: 0 };
  return {
    calls,
    plan: async () => (calls.plan++, queries),
    run: async () => ({ copies: found[calls.run++] ?? [] }),
    log: () => undefined,
  };
}

describe("повторные заходы", () => {
  it("не ищет ещё раз, если публикаций хватает", async () => {
    const first = { copies: ["a", "b", "c", "d", "e"].map((u) => copy(`https://${u}.md/1`)) };
    const s = steps([]);
    const result = await searchUntilFound("c", first, [], s);
    assert.equal(result.passes, 1);
    assert.equal(s.calls.run, 0);
  });

  it("делает не больше трёх заходов и честно отдаёт то, что нашёл", async () => {
    const s = steps([[], []]);
    const result = await searchUntilFound("c", { copies: [] }, [], s);
    assert.equal(result.passes, MAX_SEARCH_PASSES);
    assert.equal(s.calls.run, MAX_SEARCH_PASSES - 1);
    assert.deepEqual(result.copies, []);
  });

  it("останавливается, когда новых запросов нет", async () => {
    const s = steps([], []);
    const result = await searchUntilFound("c", { copies: [] }, [], s);
    assert.equal(result.passes, 1);
  });

  it("останавливается, когда публикаций стало достаточно", async () => {
    const more = ["a", "b", "c", "d", "e"].map((u) => copy(`https://${u}.md/1`));
    const s = steps([more]);
    const result = await searchUntilFound("c", { copies: [] }, [], s);
    assert.equal(result.passes, 2);
    assert.equal(result.copies.length, 5);
  });
});

describe("слияние заходов", () => {
  it("убирает повторы, сортирует по дате и заново выдаёт id", () => {
    const merged = mergeCopies("c", [
      [copy("https://www.a.md/1/", "2026-10-09")],
      [copy("https://a.md/1", "2026-10-09"), copy("https://b.md/2", "2026-06-08")],
    ]);
    assert.deepEqual(
      merged.map((c) => [c.id, c.url]),
      [
        ["c_c1", "https://b.md/2"],
        ["c_c2", "https://www.a.md/1/"],
      ],
    );
  });
});
