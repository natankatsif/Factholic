import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { Claim, ClaimStructure, TimeMarker } from "../03-claim-extraction/types.ts";
import { VIDEO_NODE_ID, type ProvenanceTree, type TreeNode } from "../05-provenance/types.ts";
import { checkRootDate } from "./index.ts";
import { mockOldContentOutput, mockRootDateInput, mockRootDateOutput } from "./mock.ts";
import type { RootDateInput } from "./types.ts";

// ---------- данные ----------

const VIDEO_AT = "2026-10-02T09:00:00Z";

const baseStructure: ClaimStructure = {
  numbers: [],
  places: ["Кишинёв"],
  eventTime: null,
  timeMarkers: [],
  certainty: "asserted",
  attributedTo: null,
};

function node(id: string, publishedAt: string | undefined, structure: ClaimStructure | null): TreeNode {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    publisher: id,
    domain: "example.com",
    publishedAt,
    parentId: null,
    via: null,
    confidence: null,
    structure,
  };
}

interface Case {
  markers?: TimeMarker[];
  /** eventTime.date */
  date?: string | null;
  /** publishedAt корня; null — корня нет (rootId: null) */
  rootAt?: string | null;
  videoAt?: string;
  now?: string;
  /** structure у claim; null — у claim её нет */
  claimStructure?: ClaimStructure | null;
  /** structure узла "video" (по умолчанию — как у claim) */
  videoStructure?: ClaimStructure | null;
}

function makeInput(c: Case): RootDateInput {
  const structure: ClaimStructure = {
    ...baseStructure,
    timeMarkers: c.markers ?? [],
    eventTime: c.date === undefined ? null : { raw: "когда-то", date: c.date },
  };
  const claimStructure = c.claimStructure === undefined ? structure : c.claimStructure;
  const claim: Claim = { ...mockClaim, id: "clm_t", structure: claimStructure ?? undefined };
  const videoStructure = c.videoStructure === undefined ? claimStructure : c.videoStructure;
  const rootAt = c.rootAt === undefined ? "2026-10-02T06:00:00Z" : c.rootAt;
  const tree: ProvenanceTree = {
    claimId: "clm_t",
    rootId: rootAt === null ? null : "src_root",
    nodes: [
      ...(rootAt === null ? [] : [node("src_root", rootAt, structure)]),
      node(VIDEO_NODE_ID, c.videoAt ?? VIDEO_AT, videoStructure),
    ],
    voteGroups: {},
  };
  return { claim, tree, videoPublishedAt: "videoAt" in c ? c.videoAt : VIDEO_AT, now: c.now };
}

const run = (c: Case) => checkRootDate(makeInput(c));
const claimedAt = (c: Case) => run(c).claimedAt;
const flagged = (c: Case) => run(c).flag !== null;

// ---------- тесты ----------

describe("checkRootDate: примеры из mock.ts", () => {
  it("«сейчас идёт война» (today), корень Reuters того же дня → mockRootDateOutput, флага нет", () => {
    assert.deepEqual(checkRootDate(mockRootDateInput), mockRootDateOutput);
  });

  it("«вчера» в видео от 2 октября 2026, корень — январь 2021 → mockOldContentOutput", () => {
    const out = run({ markers: ["yesterday"], rootAt: "2021-01-14T07:30:00Z" });
    assert.deepEqual(out, { ...mockOldContentOutput, claimId: "clm_t" });
  });
});

describe("checkRootDate: claimedAt по маркерам — от даты видео, начало суток UTC", () => {
  const cases: Array<[TimeMarker, string]> = [
    ["just_now", "2026-10-02T00:00:00Z"],
    ["today", "2026-10-02T00:00:00Z"],
    ["yesterday", "2026-10-01T00:00:00Z"],
    ["this_week", "2026-09-25T00:00:00Z"],
    ["recently", "2026-09-25T00:00:00Z"],
  ];
  for (const [marker, expected] of cases) {
    it(`${marker} → ${expected}`, () => {
      assert.equal(claimedAt({ markers: [marker] }), expected);
    });
  }

  it("несколько маркеров → самый «свежий»", () => {
    assert.equal(claimedAt({ markers: ["recently", "yesterday"] }), "2026-10-01T00:00:00Z");
    assert.equal(claimedAt({ markers: ["this_week", "today", "yesterday"] }), "2026-10-02T00:00:00Z");
  });

  it("нет даты видео → от now", () => {
    assert.equal(
      claimedAt({ markers: ["yesterday"], videoAt: undefined, now: "2026-10-03T23:59:00Z" }),
      "2026-10-02T00:00:00Z",
    );
  });

  it("дата видео не разбирается → от now", () => {
    assert.equal(
      claimedAt({ markers: ["today"], videoAt: "вчера", now: "2026-10-03T12:00:00Z" }),
      "2026-10-03T00:00:00Z",
    );
  });

  it("нет ни даты видео, ни now → от текущего времени", () => {
    const day = (offset: number) =>
      new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000 - offset * 86_400_000)
        .toISOString()
        .replace(".000Z", "Z");
    const before = day(1);
    const got = claimedAt({ markers: ["yesterday"], videoAt: undefined });
    const after = day(1);
    // тест мог пересечь полночь UTC
    assert.ok(got === before || got === after, got ?? "null");
  });
});

describe("checkRootDate: claimedAt по явной дате", () => {
  it('"2022" → начало года, "2022-02" → начало месяца, "2022-02-24" → этот день', () => {
    assert.equal(claimedAt({ date: "2022" }), "2022-01-01T00:00:00Z");
    assert.equal(claimedAt({ date: "2022-02" }), "2022-02-01T00:00:00Z");
    assert.equal(claimedAt({ date: "2022-02-24" }), "2022-02-24T00:00:00Z");
    assert.equal(claimedAt({ date: " 2022-02-24T15:30:00Z " }), "2022-02-24T00:00:00Z");
  });

  it("явная дата важнее маркеров", () => {
    assert.equal(claimedAt({ date: "2021-01-14", markers: ["yesterday"] }), "2021-01-14T00:00:00Z");
  });

  it("дата не разбирается или её нет (date: null) → по маркерам", () => {
    for (const date of ["2022-13", "2022-02-30", "вчера", "", "22-02-2022", null]) {
      assert.equal(claimedAt({ date, markers: ["yesterday"] }), "2026-10-01T00:00:00Z", String(date));
    }
  });

  it("ни даты, ни маркеров → claimedAt null, флага нет; дата корня всё равно есть", () => {
    assert.deepEqual(run({ date: "когда-то", rootAt: "2001-01-01T00:00:00Z" }), {
      claimId: "clm_t",
      claimedAt: null,
      rootPublishedAt: "2001-01-01T00:00:00Z",
      flag: null,
    });
    assert.equal(claimedAt({}), null);
  });
});

describe("checkRootDate: дата корня", () => {
  it("rootId null → rootPublishedAt null, флага нет", () => {
    const out = run({ markers: ["yesterday"], rootAt: null });
    assert.equal(out.claimedAt, "2026-10-01T00:00:00Z");
    assert.equal(out.rootPublishedAt, null);
    assert.equal(out.flag, null);
  });

  it("у корня нет даты или она не разбирается → null, флага нет", () => {
    const noDate = makeInput({ markers: ["yesterday"] });
    noDate.tree.nodes[0] = { ...noDate.tree.nodes[0], publishedAt: undefined };
    assert.deepEqual([checkRootDate(noDate).rootPublishedAt, checkRootDate(noDate).flag], [null, null]);
    noDate.tree.nodes[0] = { ...noDate.tree.nodes[0], publishedAt: "давно" };
    assert.deepEqual([checkRootDate(noDate).rootPublishedAt, checkRootDate(noDate).flag], [null, null]);
  });

  it("rootId указывает на узел, которого нет в дереве → null", () => {
    const input = makeInput({ markers: ["yesterday"], rootAt: "2001-01-01T00:00:00Z" });
    input.tree.rootId = "src_missing";
    assert.equal(checkRootDate(input).rootPublishedAt, null);
    assert.equal(checkRootDate(input).flag, null);
  });
});

describe("checkRootDate: допуски на границе (больше допуска — флаг, ровно допуск — нет)", () => {
  const cases: Array<{ name: string; c: Case; edge: string; past: string }> = [
    // заявлено 2026-10-02 → допуск 3 дня → граница 2026-09-29T00:00Z
    {
      name: "just_now — 3 дня",
      c: { markers: ["just_now"] },
      edge: "2026-09-29T00:00:00Z",
      past: "2026-09-28T23:59:59Z",
    },
    {
      name: "today — 3 дня",
      c: { markers: ["today"] },
      edge: "2026-09-29T00:00:00Z",
      past: "2026-09-28T23:59:59Z",
    },
    // заявлено 2026-10-01
    {
      name: "yesterday — 3 дня",
      c: { markers: ["yesterday"] },
      edge: "2026-09-28T00:00:00Z",
      past: "2026-09-27T23:59:59Z",
    },
    // заявлено 2026-09-25 → допуск 14 дней
    {
      name: "this_week — 14 дней",
      c: { markers: ["this_week"] },
      edge: "2026-09-11T00:00:00Z",
      past: "2026-09-10T23:59:59Z",
    },
    {
      name: "recently — 14 дней",
      c: { markers: ["recently"] },
      edge: "2026-09-11T00:00:00Z",
      past: "2026-09-10T23:59:59Z",
    },
    // явная дата 2024-12-20 → допуск 2 дня
    {
      name: "явная дата — 2 дня",
      c: { date: "2024-12-20" },
      edge: "2024-12-18T00:00:00Z",
      past: "2024-12-17T23:59:59Z",
    },
  ];
  for (const { name, c, edge, past } of cases) {
    it(name, () => {
      assert.equal(flagged({ ...c, rootAt: edge }), false, edge);
      assert.equal(flagged({ ...c, rootAt: past }), true, past);
    });
  }

  it("корень позже заявленной даты → флага нет", () => {
    assert.equal(flagged({ markers: ["yesterday"], rootAt: "2026-10-02T08:00:00Z" }), false);
    assert.equal(flagged({ date: "2022", rootAt: "2022-06-01T00:00:00Z" }), false);
  });

  it("флаг несёт обе даты: rootPublishedAt — как в узле, claimedAt — начало суток", () => {
    const out = run({ markers: ["today"], rootAt: "2025-03-08T17:45:00+02:00" });
    assert.equal(out.rootPublishedAt, "2025-03-08T17:45:00+02:00");
    assert.deepEqual(
      { ...out.flag, note: undefined },
      {
        type: "old_content",
        rootPublishedAt: "2025-03-08T17:45:00+02:00",
        claimedAt: "2026-10-02T00:00:00Z",
        note: undefined,
      },
    );
  });
});

describe("checkRootDate: note — по-русски, с обеими датами", () => {
  const ROOT = "2021-01-14T07:30:00Z";
  const note = (c: Case) => run({ ...c, rootAt: ROOT }).flag?.note;

  it("маркеры: как подано в видео и заявленная дата", () => {
    assert.equal(
      note({ markers: ["just_now"] }),
      "Первая публикация — 14 января 2021, а в видео это подано как только что случившееся (2 октября 2026).",
    );
    assert.equal(
      note({ markers: ["today"] }),
      "Первая публикация — 14 января 2021, а в видео это подано как сегодняшнее событие (2 октября 2026).",
    );
    assert.equal(
      note({ markers: ["this_week"] }),
      "Первая публикация — 14 января 2021, а в видео это подано как событие этой недели (не раньше 25 сентября 2026).",
    );
    assert.equal(
      note({ markers: ["recently"] }),
      "Первая публикация — 14 января 2021, а в видео это подано как недавнее событие (не раньше 25 сентября 2026).",
    );
  });

  it("явная дата: с точностью до дня, месяца или года", () => {
    assert.equal(
      note({ date: "2024-12-20" }),
      "Первая публикация — 14 января 2021, а по словам видео событие произошло 20 декабря 2024.",
    );
    assert.equal(
      note({ date: "2024-05" }),
      "Первая публикация — 14 января 2021, а по словам видео событие произошло в мае 2024.",
    );
    assert.equal(
      note({ date: "2024" }),
      "Первая публикация — 14 января 2021, а по словам видео событие произошло в 2024 году.",
    );
  });
});

describe("checkRootDate: откуда берётся структура", () => {
  const yesterday: ClaimStructure = { ...baseStructure, timeMarkers: ["yesterday"] };
  const today: ClaimStructure = { ...baseStructure, timeMarkers: ["today"] };

  it("у claim нет structure → берётся structure узла video", () => {
    const out = run({ claimStructure: null, videoStructure: yesterday, rootAt: "2021-01-14T07:30:00Z" });
    assert.equal(out.claimedAt, "2026-10-01T00:00:00Z");
    assert.equal(out.flag?.type, "old_content");
  });

  it("structure у claim важнее, чем у узла video", () => {
    assert.equal(claimedAt({ claimStructure: today, videoStructure: yesterday }), "2026-10-02T00:00:00Z");
  });

  it("нет structure ни у claim, ни у узла video → claimedAt null, флага нет", () => {
    const out = run({ claimStructure: null, videoStructure: null, rootAt: "2021-01-14T07:30:00Z" });
    assert.deepEqual([out.claimedAt, out.flag], [null, null]);
    assert.equal(out.rootPublishedAt, "2021-01-14T07:30:00Z");
  });

  it("у claim нет structure, узла video в дереве нет → claimedAt null", () => {
    const input = makeInput({ claimStructure: null, videoStructure: yesterday });
    input.tree.nodes = input.tree.nodes.filter((n) => n.id !== VIDEO_NODE_ID);
    assert.equal(checkRootDate(input).claimedAt, null);
  });
});
