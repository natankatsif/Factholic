import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankResults } from "./searxng.ts";

describe("очистка выдачи SearXNG", () => {
  it("оставляет близкие к запросу, ранние первыми, без повторов", () => {
    const row = (url: string, title: string, publishedDate?: string) => ({ url, title, publishedDate });
    const results = [
      row("https://a.md/1", "Дрон упал в Молдове", "2026-06-09"),
      row("https://a.md/1", "Дрон упал в Молдове", "2026-06-09"),
      row("https://b.md/2", "Дрон над Молдовой", "2026-06-08"),
      row("https://c.md/3", "Футбол в Кишинёве", "2026-01-01"),
    ];
    assert.deepEqual(
      rankResults(results, "дрон Молдова").map((r) => r.url),
      ["https://b.md/2", "https://a.md/1"],
    );
  });
});
