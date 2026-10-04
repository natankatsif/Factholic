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
    // счёт сторон — независимые группы из 08, а не число источников
    assert.deepEqual(res.sides, { for: 2, against: 0, mixed: 1 });
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
              toId: "video",
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

describe("09-report: флаги из мутаций", () => {
  type M = {
    fromId: string;
    toId: string;
    field: "numbers" | "place" | "time" | "certainty" | "attribution";
    before: string;
    after: string;
    direction: "inflated" | "deflated" | "shifted" | "added" | "removed" | "changed";
  };
  const flagsFor = (mutations: M[]) =>
    toFactCheck({
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: mockStancesOutput,
      provenance: {
        tree: mockProvenanceTree,
        mutations: { claimId: mockClaim.id, mutations: mutations.map((m) => ({ ...m, note: "" })) },
        rootDate: { ...mockRootDateOutput, flag: null },
      },
    }).flags.map((f) => `${f.label}: ${f.detail}`);
  const m = (
    field: M["field"],
    direction: M["direction"],
    before: string,
    after: string,
    edge = "a>video",
  ): M => {
    const [fromId, toId] = edge.split(">") as [string, string];
    return { fromId, toId, field, before, after, direction };
  };

  it("«со ссылкой на источник → как факт» — не «Раздуто», а «Подано увереннее»", () => {
    assert.deepEqual(flagsFor([m("certainty", "inflated", "со ссылкой на источник", "как факт")]), [
      "Подано увереннее: со ссылкой на источник → как факт",
    ]);
  });

  it("перепечатка добавила ссылку на источник — флага нет; убрала — «Убрана ссылка на источник»", () => {
    assert.deepEqual(flagsFor([m("attribution", "added", "без ссылки на источник", "ООН")]), []);
    assert.deepEqual(flagsFor([m("attribution", "removed", "мэрия", "без ссылки на источник")]), [
      "Убрана ссылка на источник: мэрия → без ссылки на источник",
    ]);
  });

  it("ссылку убрали и поэтому «как факт» на том же ребре — один флаг, а не два", () => {
    assert.deepEqual(
      flagsFor([
        m("certainty", "inflated", "со ссылкой на источник", "как факт"),
        m("attribution", "removed", "мэрия", "без ссылки на источник"),
      ]),
      ["Убрана ссылка на источник: мэрия → без ссылки на источник"],
    );
  });

  it("одна и та же мутация на нескольких рёбрах — один флаг", () => {
    assert.deepEqual(
      flagsFor([
        m("numbers", "inflated", "2", "200", "a>video"),
        m("numbers", "inflated", "2", "200", "b>video"),
        m("numbers", "inflated", "2", "200", "c>video"),
      ]),
      ["Раздуто: 2 → 200"],
    );
  });
});

describe("09-report: итог и шум", () => {
  const withMutations = (mutations: Array<Record<string, string>>, status?: string) =>
    toFactCheck({
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: status
        ? { ...mockStancesOutput, consensus: { ...mockStancesOutput.consensus, status } }
        : mockStancesOutput,
      provenance: {
        tree: mockProvenanceTree,
        mutations: {
          claimId: mockClaim.id,
          mutations: mutations.map((m) => ({ fromId: "a", toId: "video", note: "", ...m })),
        },
        rootDate: { ...mockRootDateOutput, flag: null },
      },
    } as never);

  it("перепечатка добавила место или время, о которых источник молчал, — не искажение", () => {
    const res = withMutations([
      { field: "place", direction: "added", before: "—", after: "Донбасс" },
      { field: "time", direction: "added", before: "—", after: "2014 год" },
    ]);
    assert.deepEqual(res.flags, []);
  });

  it("источники возражают — итог «против», даже если есть флаги", () => {
    const res = withMutations(
      [{ field: "numbers", direction: "inflated", before: "2", after: "200" }],
      "mostly_against",
    );
    assert.equal(res.consensus, "against");
    assert.equal(res.flags.length, 1);
  });

  it("не больше 5 флагов, «раздуто» — раньше искажений", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      field: "place",
      direction: "changed",
      before: `место ${i}`,
      after: `другое ${i}`,
    }));
    const res = withMutations([
      ...many,
      { field: "numbers", direction: "inflated", before: "2", after: "200" },
    ]);
    assert.equal(res.flags.length, 5);
    assert.equal(res.flags[0].label, "Раздуто");
  });
});

describe("09-report: флаги — только путь к проверяемому материалу", () => {
  const report = (mutations: Array<Record<string, string>>) =>
    toFactCheck({
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: mockStancesOutput,
      provenance: {
        tree: mockProvenanceTree,
        mutations: { claimId: mockClaim.id, mutations: mutations.map((m) => ({ note: "", ...m })) },
        rootDate: { ...mockRootDateOutput, flag: null },
      },
    } as never);

  it("различия между копиями (одна добавила подробность другой) — не флаг утверждения", () => {
    const res = report([
      { fromId: "a", toId: "b", field: "numbers", direction: "added", before: "—", after: "2014 год" },
      { fromId: "a", toId: "b", field: "numbers", direction: "inflated", before: "2", after: "200" },
    ]);
    assert.deepEqual(res.flags, []);
  });

  it("только мягкий флаг (не сослались на источник) — итог не «с флагами», заголовок не он", () => {
    const res = report([
      {
        fromId: "a",
        toId: "video",
        field: "attribution",
        direction: "removed",
        before: "ООН",
        after: "без ссылки",
      },
    ]);
    assert.equal(res.flags.length, 1);
    assert.notEqual(res.consensus, "flagged");
    assert.notEqual(res.keyFinding?.title, "Убрана ссылка на источник");
  });
});

describe("09-report: цифра, которой нет у первоисточника", () => {
  it("мягкий флаг «Цифра не из первоисточника», итог не «с флагами»", () => {
    const res = toFactCheck({
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
              fromId: "a",
              toId: "video",
              field: "numbers",
              direction: "added",
              before: "—",
              after: "2,5 млн",
              note: "",
            },
          ],
        },
        rootDate: { ...mockRootDateOutput, flag: null },
      },
    } as never);
    assert.deepEqual(
      res.flags.map((f) => f.label),
      ["Цифра не из первоисточника"],
    );
    assert.notEqual(res.consensus, "flagged");
  });
});

describe("09-report: недостаточно информации после поиска", () => {
  it("жёсткий пробел поиска — итог «недостаточно информации» и главный вывод с причиной", () => {
    const res = toFactCheck({
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: mockStancesOutput,
      provenance: null,
      search: {
        rounds: 3,
        sufficient: false,
        unconfirmed: ["ни один источник не называет число 200 (пострадавших)"],
        gaps: [],
      },
    });
    assert.equal(res.consensus, "unverifiable");
    assert.equal(
      res.consensusSummary,
      "недостаточно информации: ни один источник не называет число 200 (пострадавших)",
    );
    assert.equal(res.keyFinding?.title, "Недостаточно информации");
  });

  it("первоисточник не связан с материалом — в пути первым, но с разрывом (linked: false)", () => {
    const node = (
      id: string,
      publisher: string,
      publishedAt: string | undefined,
      parentId: string | null,
    ) => ({
      id,
      url: `https://${publisher}/x`,
      title: publisher,
      publisher,
      domain: publisher,
      ...(publishedAt ? { publishedAt } : {}),
      parentId,
      via: parentId ? ("duplicate" as const) : null,
      confidence: parentId ? ("probable" as const) : null,
      structure: null,
    });
    const res = toFactCheck({
      kind: "checked",
      claim: mockClaim,
      sources: mockSourceSearchOutput.sources,
      stances: mockStancesOutput,
      provenance: {
        tree: {
          claimId: mockClaim.id,
          rootId: "a",
          // a — самая ранняя, но ни с чем не связана; b → материал
          nodes: [
            node("a", "euronews.ro", "2023-02-20T00:00:00Z", null),
            node("b", "libertatea.ro", "2026-02-23T00:00:00Z", null),
            node("video", "Это видео", undefined, "b"),
          ],
          voteGroups: {},
        },
        mutations: { claimId: mockClaim.id, mutations: [] },
        rootDate: mockRootDateOutput,
      },
    });
    const path = res.provenance?.pathSummary ?? [];
    assert.deepEqual(
      path.map((p) => [p.name, p.tag, p.linked ?? true]),
      [
        ["euronews.ro", "оригинал", true],
        ["libertatea.ro", "начало цепочки", false],
        ["Это видео", "пересказ", true],
      ],
    );
  });
});
