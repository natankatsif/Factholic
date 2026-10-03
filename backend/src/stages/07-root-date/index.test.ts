import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { Claim, ClaimStructure } from "../03-claim-extraction/types.ts";
import { VIDEO_NODE_ID, type ProvenanceTree, type TreeNode } from "../05-provenance/types.ts";
import { checkRootDate } from "./index.ts";
import { mockOldContentOutput, mockRootDateInput, mockRootDateOutput } from "./mock.ts";
import type { RootDateInput } from "./types.ts";

// ---------- данные ----------

const VIDEO_AT = "2026-10-02T09:00:00Z";

type Time = ClaimStructure["time"];

const baseStructure: ClaimStructure = {
  event: "пожар на складе",
  numbers: [],
  places: ["Кишинёв"],
  time: null,
  certainty: "asserted",
  certaintyMarkers: [],
  attributedTo: null,
};

/** Относительное время: «вчера»; date — если её посчитал этап 03 от даты публикации */
const rel = (text: string, date: string | null = null): Time => ({ text, date, relative: true });
/** Явная дата: «24 февраля 2022» */
const abs = (date: string | null, text = "когда-то"): Time => ({ text, date, relative: false });

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
  /** structure.time; по умолчанию null */
  time?: Time;
  /** publishedAt корня; null — корня нет (rootId: null) */
  rootAt?: string | null;
  videoAt?: string;
  now?: string;
  /** structure у claim; null — у claim её нет */
  claimStructure?: ClaimStructure | null;
  /** structure узла "video" (по умолчанию — как у claim) */
  videoStructure?: ClaimStructure | null;
  /** structure.time корня — как утверждение подано в первоисточнике (по умолчанию время не названо) */
  rootTime?: Time;
}

function makeInput(c: Case): RootDateInput {
  const structure: ClaimStructure = { ...baseStructure, time: c.time ?? null };
  const claimStructure = c.claimStructure === undefined ? structure : c.claimStructure;
  const claim: Claim = { ...mockClaim, id: "clm_t", structure: claimStructure ?? undefined };
  const videoStructure = c.videoStructure === undefined ? claimStructure : c.videoStructure;
  const rootAt = c.rootAt === undefined ? "2026-10-02T06:00:00Z" : c.rootAt;
  const tree: ProvenanceTree = {
    claimId: "clm_t",
    rootId: rootAt === null ? null : "src_root",
    nodes: [
      ...(rootAt === null ? [] : [node("src_root", rootAt, { ...structure, time: c.rootTime ?? null })]),
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
  it("«сейчас идёт война» (relative «сейчас»), корень Reuters того же дня → mockRootDateOutput, флага нет", () => {
    assert.deepEqual(checkRootDate(mockRootDateInput), mockRootDateOutput);
  });

  it("«вчера» в видео от 2 октября 2026, корень — январь 2021 → mockOldContentOutput", () => {
    // дату посчитал этап 03 или нет — результат тот же
    for (const time of [rel("вчера"), rel("вчера", "2026-10-01")]) {
      const out = run({ time, rootAt: "2021-01-14T07:30:00Z" });
      assert.deepEqual(out, { ...mockOldContentOutput, claimId: "clm_t" }, JSON.stringify(time));
    }
  });
});

describe("checkRootDate: claimedAt по словам относительного времени — от даты видео, начало суток UTC", () => {
  const cases: Array<[string, string]> = [
    ["только что", "2026-10-02T00:00:00Z"],
    ["сейчас", "2026-10-02T00:00:00Z"],
    ["сегодня утром", "2026-10-02T00:00:00Z"],
    ["acum", "2026-10-02T00:00:00Z"],
    ["azi", "2026-10-02T00:00:00Z"],
    ["astăzi", "2026-10-02T00:00:00Z"],
    ["now", "2026-10-02T00:00:00Z"],
    ["Today", "2026-10-02T00:00:00Z"],
    ["вчера", "2026-10-01T00:00:00Z"],
    ["вчера вечером", "2026-10-01T00:00:00Z"],
    ["ieri", "2026-10-01T00:00:00Z"],
    ["yesterday", "2026-10-01T00:00:00Z"],
    ["на этой неделе", "2026-09-25T00:00:00Z"],
    ["недавно", "2026-09-25T00:00:00Z"],
    ["săptămâna aceasta", "2026-09-25T00:00:00Z"],
    ["recent", "2026-09-25T00:00:00Z"],
    ["this week", "2026-09-25T00:00:00Z"],
    ["recently", "2026-09-25T00:00:00Z"],
  ];
  for (const [text, expected] of cases) {
    it(`«${text}» → ${expected}`, () => {
      assert.equal(claimedAt({ time: rel(text) }), expected);
    });
  }

  it("несколько слов → самое «свежее»", () => {
    assert.equal(claimedAt({ time: rel("недавно, а именно вчера") }), "2026-10-01T00:00:00Z");
    assert.equal(claimedAt({ time: rel("на этой неделе, сегодня и вчера") }), "2026-10-02T00:00:00Z");
  });

  it("слова не узнаны → claimedAt null («позавчера», «acum 3 ani» — «три года назад», «snow»)", () => {
    for (const text of ["позавчера", "alaltăieri", "acum 3 ani", "acum 30 de ani", "snow", "в прошлом", ""]) {
      assert.equal(claimedAt({ time: rel(text) }), null, text);
    }
  });

  it("нет даты видео → от now", () => {
    assert.equal(
      claimedAt({ time: rel("вчера"), videoAt: undefined, now: "2026-10-03T23:59:00Z" }),
      "2026-10-02T00:00:00Z",
    );
  });

  it("дата видео не разбирается → от now", () => {
    assert.equal(
      claimedAt({ time: rel("сегодня"), videoAt: "вчера", now: "2026-10-03T12:00:00Z" }),
      "2026-10-03T00:00:00Z",
    );
  });

  it("нет ни даты видео, ни now → от текущего времени", () => {
    const day = (offset: number) =>
      new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000 - offset * 86_400_000)
        .toISOString()
        .replace(".000Z", "Z");
    const before = day(1);
    const got = claimedAt({ time: rel("вчера"), videoAt: undefined });
    const after = day(1);
    // тест мог пересечь полночь UTC
    assert.ok(got === before || got === after, got ?? "null");
  });
});

describe("checkRootDate: claimedAt по time.date", () => {
  it('"2022" → начало года, "2022-02" → начало месяца, "2022-02-24" → этот день', () => {
    assert.equal(claimedAt({ time: abs("2022") }), "2022-01-01T00:00:00Z");
    assert.equal(claimedAt({ time: abs("2022-02") }), "2022-02-01T00:00:00Z");
    assert.equal(claimedAt({ time: abs("2022-02-24") }), "2022-02-24T00:00:00Z");
    assert.equal(claimedAt({ time: abs(" 2022-02-24T15:30:00Z ") }), "2022-02-24T00:00:00Z");
  });

  it("у относительного времени дата от этапа 03 важнее слов", () => {
    assert.equal(claimedAt({ time: rel("вчера", "2021-01-14") }), "2021-01-14T00:00:00Z");
    assert.equal(claimedAt({ time: rel("позавчера", "2026-09-30") }), "2026-09-30T00:00:00Z");
    assert.equal(claimedAt({ time: rel("в прошлом месяце", "2026-09") }), "2026-09-01T00:00:00Z");
  });

  it("относительное время, дата не разбирается или её нет (date: null) → по словам", () => {
    for (const date of ["2022-13", "2022-02-30", "вчера", "", "22-02-2022", null]) {
      assert.equal(claimedAt({ time: rel("вчера", date) }), "2026-10-01T00:00:00Z", String(date));
    }
  });

  it("не относительное время без разбираемой даты, или времени нет → claimedAt null, флага нет", () => {
    assert.deepEqual(run({ time: abs("когда-то"), rootAt: "2001-01-01T00:00:00Z" }), {
      claimId: "clm_t",
      claimedAt: null,
      rootPublishedAt: "2001-01-01T00:00:00Z",
      flag: null,
    });
    // relative: false — слова не смотрим, даже если там «вчера»
    assert.equal(claimedAt({ time: abs(null, "вчера") }), null);
    assert.equal(claimedAt({}), null);
  });
});

describe("checkRootDate: дата корня", () => {
  it("rootId null → rootPublishedAt null, флага нет", () => {
    const out = run({ time: rel("вчера"), rootAt: null });
    assert.equal(out.claimedAt, "2026-10-01T00:00:00Z");
    assert.equal(out.rootPublishedAt, null);
    assert.equal(out.flag, null);
  });

  it("у корня нет даты или она не разбирается → null, флага нет", () => {
    const noDate = makeInput({ time: rel("вчера") });
    noDate.tree.nodes[0] = { ...noDate.tree.nodes[0], publishedAt: undefined };
    assert.deepEqual([checkRootDate(noDate).rootPublishedAt, checkRootDate(noDate).flag], [null, null]);
    noDate.tree.nodes[0] = { ...noDate.tree.nodes[0], publishedAt: "давно" };
    assert.deepEqual([checkRootDate(noDate).rootPublishedAt, checkRootDate(noDate).flag], [null, null]);
  });

  it("rootId указывает на узел, которого нет в дереве → null", () => {
    const input = makeInput({ time: rel("вчера"), rootAt: "2001-01-01T00:00:00Z" });
    input.tree.rootId = "src_missing";
    assert.equal(checkRootDate(input).rootPublishedAt, null);
    assert.equal(checkRootDate(input).flag, null);
  });
});

describe("checkRootDate: допуски на границе (больше допуска — флаг, ровно допуск — нет)", () => {
  const cases: Array<{ name: string; c: Case; edge: string; past: string }> = [
    // заявлено 2026-10-02 → допуск 3 дня → граница 2026-09-29T00:00Z
    {
      name: "«только что» — 3 дня",
      c: { time: rel("только что") },
      edge: "2026-09-29T00:00:00Z",
      past: "2026-09-28T23:59:59Z",
    },
    {
      name: "«сейчас» — 3 дня",
      c: { time: rel("сейчас") },
      edge: "2026-09-29T00:00:00Z",
      past: "2026-09-28T23:59:59Z",
    },
    {
      name: "«сегодня» — 3 дня",
      c: { time: rel("сегодня") },
      edge: "2026-09-29T00:00:00Z",
      past: "2026-09-28T23:59:59Z",
    },
    // заявлено 2026-10-01
    {
      name: "«вчера» — 3 дня",
      c: { time: rel("вчера") },
      edge: "2026-09-28T00:00:00Z",
      past: "2026-09-27T23:59:59Z",
    },
    {
      name: "«вчера» с датой от этапа 03 — 3 дня",
      c: { time: rel("вчера", "2026-10-01") },
      edge: "2026-09-28T00:00:00Z",
      past: "2026-09-27T23:59:59Z",
    },
    {
      name: "незнакомое слово с датой от этапа 03 — 3 дня",
      c: { time: rel("позавчера", "2026-09-30") },
      edge: "2026-09-27T00:00:00Z",
      past: "2026-09-26T23:59:59Z",
    },
    // заявлено 2026-09-25 → допуск 14 дней
    {
      name: "«на этой неделе» — 14 дней",
      c: { time: rel("на этой неделе") },
      edge: "2026-09-11T00:00:00Z",
      past: "2026-09-10T23:59:59Z",
    },
    {
      name: "«недавно» — 14 дней",
      c: { time: rel("недавно") },
      edge: "2026-09-11T00:00:00Z",
      past: "2026-09-10T23:59:59Z",
    },
    // явная дата 2024-12-20 → допуск год (раньше выходят прогнозы и анонсы)
    {
      name: "явная дата — год",
      c: { time: abs("2024-12-20") },
      edge: "2023-12-21T00:00:00Z",
      past: "2023-12-20T23:59:59Z",
    },
  ];
  for (const { name, c, edge, past } of cases) {
    it(name, () => {
      assert.equal(flagged({ ...c, rootAt: edge }), false, edge);
      assert.equal(flagged({ ...c, rootAt: past }), true, past);
    });
  }

  it("корень позже заявленной даты → флага нет", () => {
    assert.equal(flagged({ time: rel("вчера"), rootAt: "2026-10-02T08:00:00Z" }), false);
    assert.equal(flagged({ time: abs("2022"), rootAt: "2022-06-01T00:00:00Z" }), false);
  });

  it("флаг несёт обе даты: rootPublishedAt — как в узле, claimedAt — начало суток", () => {
    const out = run({ time: rel("сегодня"), rootAt: "2025-03-08T17:45:00+02:00" });
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

  it("относительное время: как подано в видео и заявленная дата", () => {
    assert.equal(
      note({ time: rel("только что") }),
      "Первая публикация — 14 января 2021, а в видео это подано как только что случившееся (2 октября 2026).",
    );
    assert.equal(
      note({ time: rel("сейчас") }),
      "Первая публикация — 14 января 2021, а в видео это подано как происходящее сейчас (2 октября 2026).",
    );
    assert.equal(
      note({ time: rel("azi") }),
      "Первая публикация — 14 января 2021, а в видео это подано как сегодняшнее событие (2 октября 2026).",
    );
    assert.equal(
      note({ time: rel("на этой неделе") }),
      "Первая публикация — 14 января 2021, а в видео это подано как событие этой недели (не раньше 25 сентября 2026).",
    );
    assert.equal(
      note({ time: rel("recently") }),
      "Первая публикация — 14 января 2021, а в видео это подано как недавнее событие (не раньше 25 сентября 2026).",
    );
  });

  it("относительное время с датой от этапа 03: дата с её точностью, незнакомое слово — цитатой", () => {
    assert.equal(
      note({ time: rel("вчера", "2026-10-01") }),
      "Первая публикация — 14 января 2021, а в видео это подано как вчерашнее событие (1 октября 2026).",
    );
    assert.equal(
      note({ time: rel("позавчера", "2026-09-30") }),
      "Первая публикация — 14 января 2021, а в видео это подано словами «позавчера» (30 сентября 2026).",
    );
    assert.equal(
      note({ time: rel("в прошлом месяце", "2026-09") }),
      "Первая публикация — 14 января 2021, а в видео это подано словами «в прошлом месяце» (в сентябре 2026).",
    );
  });

  it("явная дата: с точностью до дня, месяца или года", () => {
    assert.equal(
      note({ time: abs("2024-12-20") }),
      "Первая публикация — 14 января 2021, а по словам видео событие произошло 20 декабря 2024.",
    );
    assert.equal(
      note({ time: abs("2024-05") }),
      "Первая публикация — 14 января 2021, а по словам видео событие произошло в мае 2024.",
    );
    assert.equal(
      note({ time: abs("2024") }),
      "Первая публикация — 14 января 2021, а по словам видео событие произошло в 2024 году.",
    );
  });
});

describe("checkRootDate: откуда берётся структура", () => {
  const yesterday: ClaimStructure = { ...baseStructure, time: rel("вчера") };
  const today: ClaimStructure = { ...baseStructure, time: rel("сегодня") };

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

describe("checkRootDate: корень-прогноз — не старый контент", () => {
  it("публикация за полгода до явной даты (разбор прогноза, июнь → ноябрь) — флага нет", () => {
    assert.equal(
      checkRootDate(makeInput({ time: abs("2022-11", "в ноябре 2022"), rootAt: "2022-06-08T00:00:00Z" }))
        .flag,
      null,
    );
  });

  it("корень заранее называет ту же дату (прогноз ООН в июле о 15 ноября) — флага нет", () => {
    const out = checkRootDate(
      makeInput({
        time: abs("2022-11", "в ноябре 2022"),
        rootAt: "2022-07-11T00:00:00Z",
        rootTime: abs("2022-11-15", "15 ноября"),
      }),
    );
    assert.equal(out.flag, null);
  });

  it("корень о событии своего времени (2021), а видео заявляет 2024 — старый контент остаётся", () => {
    const out = checkRootDate(
      makeInput({
        time: abs("2024-12", "в декабре 2024"),
        rootAt: "2021-01-14T00:00:00Z",
        rootTime: abs("2021-01", "в январе"),
      }),
    );
    assert.equal(out.flag?.type, "old_content");
  });

  it("«вчера» в видео, а корень 2023 года без даты события — старый контент остаётся", () => {
    const out = checkRootDate(makeInput({ time: rel("вчера"), rootAt: "2023-03-14T00:00:00Z" }));
    assert.equal(out.flag?.type, "old_content");
  });
});
