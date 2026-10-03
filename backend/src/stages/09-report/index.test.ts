import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import { mockSourceSearchOutput } from "../04-source-search/mock.ts";
import { mockProvenanceTree } from "../05-provenance/mock.ts";
import { mockRootDateOutput } from "../07-root-date/mock.ts";
import { mockStancesOutput } from "../08-stances/mock.ts";
import { toFactCheck } from "./index.ts";
import type { ReportInput } from "./types.ts";

describe("09-report toFactCheck", () => {
  it("обрабатывает pending статус", () => {
    const input: ReportInput = { kind: "pending", claim: mockClaim };
    const res = toFactCheck(input);
    assert.equal(res.id, mockClaim.id);
    assert.equal(res.status, "checking");
    assert.equal(res.quote, mockClaim.quote);
    assert.equal(res.claim, mockClaim.normalized);
  });

  it("обрабатывает failed статус", () => {
    const input: ReportInput = { kind: "failed", claim: mockClaim, error: "Tavily error" };
    const res = toFactCheck(input);
    assert.equal(res.id, mockClaim.id);
    assert.equal(res.status, "failed");
    assert.equal(res.error, "Tavily error");
  });

  it("обрабатывает checked статус со сторонами и без дерева", () => {
    const input: ReportInput = {
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: mockStancesOutput,
      provenance: null,
    };
    const res = toFactCheck(input);
    assert.equal(res.id, mockClaim.id);
    assert.equal(res.status, "done");
    assert.equal(res.consensus, "converge");
    assert.equal(res.provenance, undefined);
    assert.ok(res.sources.length > 0);
  });

  it("собирает дерево, флаги и ключевой вывод при наличии provenance", () => {
    const input: ReportInput = {
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: mockStancesOutput,
      provenance: {
        tree: mockProvenanceTree,
        mutations: {
          claimId: mockClaim.id,
          mutations: [
            {
              fromId: "src_05_2",
              toId: "src_05_3",
              field: "numbers",
              before: "10",
              after: "100",
              direction: "inflated",
              note: "10 → 100",
            },
          ],
        },
        rootDate: {
          ...mockRootDateOutput,
          flag: {
            type: "old_content",
            rootPublishedAt: "2023-01-01T00:00:00Z",
            claimedAt: "2026-10-02T00:00:00Z",
            note: "Событию 3 года",
          },
        },
      },
    };
    const res = toFactCheck(input);
    assert.equal(res.status, "done");
    assert.equal(res.consensus, "flagged");
    assert.equal(res.consensusSummary, "раздуто • старое");
    assert.equal(res.flags.length, 2);
    assert.equal(res.flags[0].type, "outdated");
    assert.equal(res.flags[1].type, "exaggerated");
    assert.ok(res.keyFinding);
    assert.ok(res.provenance);
    assert.ok(res.provenance.nodes.length > 0);
    assert.ok(res.provenance.edges.length > 0);
    assert.ok(res.provenance.pathSummary.length > 0);
  });
});
