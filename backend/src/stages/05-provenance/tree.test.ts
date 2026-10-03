/** Чистые функции построения дерева: без LLM и сети. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import type { FoundSource, SourceCopy } from "../04-source-search/types.ts";
import { copiesFromSources } from "./copies.ts";
import {
  attributionEdges,
  buildTree,
  canonicalUrl,
  citeMatches,
  compareDates,
  copyCites,
  cosine,
  duplicateEdges,
  embeddingSimilarity,
  jaccard,
  linkEdges,
  pickForExtraction,
  shingles,
  shingleSimilarity,
  siteName,
  type CopyFacts,
  type Similarity,
  type VideoFacts,
} from "./tree.ts";
import { VIDEO_NODE_ID, type ProvenanceTree } from "./types.ts";

// ---------- данные ----------

const S: ClaimStructure = mockClaim.structure!;

/** Копия из этапа 04: без ссылок, атрибуций и даты, если не заданы */
function src(id: string, over: Partial<SourceCopy> = {}): SourceCopy {
  return {
    id,
    url: `https://www.${id}.example/news/${id}`,
    title: `Заголовок ${id}`,
    publisher: `Издатель ${id}`,
    domain: `${id}.example`,
    sourceType: "news",
    language: "ru",
    excerpt: "",
    outboundLinks: [],
    attributions: [],
    earliestSearch: false,
    retrievedAt: "2026-10-03T00:00:00Z",
    ...over,
  };
}

/** Копия с утверждением (structure = S), без атрибуций от LLM */
function copy(id: string, over: Partial<SourceCopy> = {}, facts: Partial<CopyFacts> = {}): CopyFacts {
  return { source: src(id, over), structure: S, cites: [], ...facts };
}

/** Похожесть: всё 0, кроме заданных пар (симметрично) и похожести на утверждение */
function sim(
  n: number,
  pairs: Array<[number, number, number]> = [],
  toClaim: number[] = [],
  method: Similarity["method"] = "embeddings",
): Similarity {
  const m: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)),
  );
  for (const [a, b, v] of pairs) {
    m[a][b] = v;
    m[b][a] = v;
  }
  return { method, pairs: m, toClaim: Array.from({ length: n }, (_, i) => toClaim[i] ?? 0) };
}

const VIDEO: VideoFacts = { url: "https://www.youtube.com/watch?v=X", title: "Видео", structure: S };

function build(copies: CopyFacts[], similarity = sim(copies.length), video: VideoFacts = VIDEO) {
  return buildTree({ claimId: "clm_t", copies, video, similarity });
}

function node(tree: ProvenanceTree, id: string) {
  const n = tree.nodes.find((x) => x.id === id);
  assert.ok(n, `нет узла ${id}`);
  return n;
}

/** [parentId, via, confidence] узла */
function edge(tree: ProvenanceTree, id: string) {
  const n = node(tree, id);
  return [n.parentId, n.via, n.confidence];
}

const D1 = "2026-10-01T10:00:00Z";
const D2 = "2026-10-02T10:00:00Z";
const D3 = "2026-10-03T10:00:00Z";

// ---------- URL и даты ----------

describe("canonicalUrl", () => {
  it("без схемы, www., #, завершающего /; хост без регистра", () => {
    assert.equal(canonicalUrl("https://www.DW.com/ru/#top"), "dw.com/ru");
    assert.equal(canonicalUrl("http://dw.com/ru"), "dw.com/ru");
    assert.equal(canonicalUrl("dw.com/ru/"), "dw.com/ru");
    assert.equal(canonicalUrl("https://www.reuters.com/"), "reuters.com");
  });

  it("без utm_* / fbclid / gclid; остальные параметры сохранены и отсортированы", () => {
    assert.equal(
      canonicalUrl("https://site.md/a/?utm_source=fb&id=5&fbclid=x&UTM_Medium=y&gclid=z&b=2"),
      "site.md/a?b=2&id=5",
    );
    assert.equal(canonicalUrl("https://site.md/a?utm_source=x"), "site.md/a");
  });

  it("кириллический путь — одинаково в закодированном и обычном виде", () => {
    assert.equal(
      canonicalUrl("https://ru.wikipedia.org/wiki/%D0%92%D0%BE%D0%B9%D0%BD%D0%B0"),
      canonicalUrl("https://ru.wikipedia.org/wiki/Война"),
    );
  });
});

describe("compareDates", () => {
  it("полные метки — по времени", () => {
    assert.equal(compareDates("2026-10-02T08:00:00Z", "2026-10-02T18:00:00Z"), -1);
    assert.equal(compareDates("2026-10-02T21:00:00+03:00", "2026-10-02T18:00:00Z"), 0);
  });

  it("день без времени равен любой метке того же дня (UTC); точность — менее точной даты", () => {
    assert.equal(compareDates("2026-10-02", "2026-10-02T18:00:00Z"), 0);
    assert.equal(compareDates("2026-10-02T18:00:00Z", "2026-10-02"), 0);
    assert.equal(compareDates("2026-10-01", "2026-10-02T00:30:00Z"), -1);
    assert.equal(compareDates("2026-10", "2026-10-31T10:00:00Z"), 0);
    assert.equal(compareDates("2026", "2025-12-31"), 1);
  });
});

describe("citeMatches", () => {
  it("издатель без регистра, по вхождению в любую сторону", () => {
    assert.ok(citeMatches("reuters", { publisher: "Reuters", domain: "reuters.com" }));
    assert.ok(citeMatches("агентства Reuters", { publisher: "Reuters", domain: "x.com" }));
    assert.ok(citeMatches("Deutsche Welle", { publisher: "Deutsche Welle (DW)", domain: "x.com" }));
  });

  it("по домену: DW ↔ dw.com", () => {
    assert.ok(citeMatches("DW", { publisher: "Deutsche Welle", domain: "dw.com" }));
    assert.ok(citeMatches("BBC", { publisher: "Би-би-си", domain: "www.news.bbc.co.uk" }));
  });

  it("только целыми словами: AP ≠ rap.md; одна буква не совпадает ни с чем", () => {
    assert.ok(!citeMatches("AP", { publisher: "Rap News", domain: "rap.md" }));
    assert.ok(!citeMatches("Reuters", { publisher: "Deutsche Welle", domain: "dw.com" }));
    assert.ok(!citeMatches("D", { publisher: "D", domain: "d.md" }));
  });

  it("фразы этапа 04: издатель внутри фразы или имя сайта из домена с заглавной", () => {
    assert.ok(citeMatches("как сообщает Reuters", { publisher: "Reuters", domain: "reuters.com" }));
    assert.ok(citeMatches("potrivit Agerpres", { publisher: "Agenția Agerpres", domain: "agerpres.ro" }));
    assert.ok(citeMatches("по данным DW", { publisher: "Deutsche Welle", domain: "www.dw.com" }));
    assert.ok(citeMatches("according to BBC", { publisher: "Би-би-си", domain: "news.bbc.co.uk" }));
    assert.ok(!citeMatches("according to news reports", { publisher: "Știri", domain: "news.md" }));
    assert.ok(!citeMatches("по данным Генштаба", { publisher: "Reuters", domain: "reuters.com" }));
    assert.ok(!citeMatches("по данным AP", { publisher: "Rap News", domain: "rap.md" }));
  });
});

describe("siteName", () => {
  it("имя сайта — метка перед зоной (и перед co/com/org второго уровня)", () => {
    assert.equal(siteName("dw.com"), "dw");
    assert.equal(siteName("www.Reuters.com"), "reuters");
    assert.equal(siteName("news.bbc.co.uk"), "bbc");
    assert.equal(siteName("ru.wikipedia.org"), "wikipedia");
    assert.equal(siteName("localhost"), "localhost");
  });
});

// ---------- рёбра ----------

describe("рёбра link", () => {
  it("ссылка на url другой копии (с www, utm, # и /) → родитель, link, confirmed", () => {
    const tree = build([
      copy("a", { url: "https://www.dw.com/ru/news-1/", publishedAt: D1 }),
      copy("b", { publishedAt: D2, outboundLinks: ["http://dw.com/ru/news-1?utm_source=tg#x"] }),
    ]);
    assert.deepEqual(edge(tree, "b"), ["a", "link", "confirmed"]);
    assert.deepEqual(edge(tree, "a"), [null, null, null]);
  });

  it("родитель позже потомка — не родитель; родитель без даты — можно (только для ссылки)", () => {
    const later = build([
      copy("a", { publishedAt: D3 }),
      copy("b", { publishedAt: D2, outboundLinks: [src("a").url] }),
    ]);
    assert.deepEqual(edge(later, "b"), [null, null, null]);
    const undated = build([copy("a"), copy("b", { publishedAt: D2, outboundLinks: [src("a").url] })]);
    assert.deepEqual(edge(undated, "b"), ["a", "link", "confirmed"]);
  });

  it("несколько ссылок: сначала копии с утверждением, среди них — самая поздняя (ближайшая)", () => {
    const copies = [
      copy("a", { publishedAt: D1 }),
      copy("b", { publishedAt: D2 }),
      copy("c", { publishedAt: D2 }, { structure: null }),
      copy("d", { publishedAt: D3, outboundLinks: [src("a").url, src("c").url, src("b").url] }),
    ];
    assert.deepEqual(
      linkEdges(copies).map((e) => e.parent),
      [1, 0, 2],
    );
    assert.deepEqual(edge(build(copies), "d"), ["b", "link", "confirmed"]);
  });

  it("ссылка на саму себя и на ту же страницу под другим id — не ребро", () => {
    const url = "https://site.md/a";
    const copies = [
      copy("a", { url, publishedAt: D1 }),
      copy("b", { url: `${url}/`, publishedAt: D2, outboundLinks: [url] }),
    ];
    assert.deepEqual(linkEdges(copies), []);
  });
});

describe("рёбра attribution", () => {
  it("«по данным Reuters» → копия Reuters, attribution, probable", () => {
    const tree = build([
      copy("r", { publisher: "Reuters", domain: "reuters.com", publishedAt: D1 }),
      copy("x", { publishedAt: D2 }, { cites: ["Reuters"] }),
    ]);
    assert.deepEqual(edge(tree, "x"), ["r", "attribution", "probable"]);
  });

  it("несколько копий одного издателя — самая ранняя", () => {
    const tree = build([
      copy("r2", { publisher: "Reuters", publishedAt: D2 }),
      copy("r1", { publisher: "Reuters", publishedAt: D1 }),
      copy("x", { publishedAt: D3 }, { cites: ["reuters"] }),
    ]);
    assert.deepEqual(edge(tree, "x"), ["r1", "attribution", "probable"]);
  });

  it("«DW со ссылкой на Reuters» → непосредственный источник (первый в cites), даже если Reuters раньше", () => {
    const copies = [
      copy("r", { publisher: "Reuters", publishedAt: D1 }),
      copy("dw", { publisher: "Deutsche Welle", domain: "dw.com", publishedAt: D2 }),
      copy("x", { publishedAt: D3 }, { cites: ["DW", "Reuters"] }),
    ];
    assert.deepEqual(
      attributionEdges(copies).map((e) => [e.parent, e.child]),
      [
        [1, 2],
        [0, 2],
      ],
    );
    assert.deepEqual(edge(build(copies), "x"), ["dw", "attribution", "probable"]);
  });

  it("родитель без даты или позже потомка — не родитель; потомок без даты — можно", () => {
    const undatedParent = build([
      copy("r", { publisher: "Reuters" }),
      copy("x", { publishedAt: D2 }, { cites: ["Reuters"] }),
    ]);
    assert.deepEqual(edge(undatedParent, "x"), [null, null, null]);
    const laterParent = build([
      copy("r", { publisher: "Reuters", publishedAt: D3 }),
      copy("x", { publishedAt: D2 }, { cites: ["Reuters"] }),
    ]);
    assert.deepEqual(edge(laterParent, "x"), [null, null, null]);
    const undatedChild = build([
      copy("r", { publisher: "Reuters", publishedAt: D1 }),
      copy("x", {}, { cites: ["Reuters"] }),
    ]);
    assert.deepEqual(edge(undatedChild, "x"), ["r", "attribution", "probable"]);
  });

  it("атрибуции этапа 04 работают и без LLM: «как сообщает Reuters» → Reuters", () => {
    const tree = build([
      copy("r", { publisher: "Reuters", domain: "reuters.com", publishedAt: D1 }),
      copy("x", { publishedAt: D2, attributions: ["как сообщает Reuters", "по данным Генштаба"] }),
    ]);
    assert.deepEqual(edge(tree, "x"), ["r", "attribution", "probable"]);
  });

  it("cites от LLM — раньше атрибуций 04: LLM назвала DW, а в тексте ещё «по данным Reuters»", () => {
    const copies = [
      copy("r", { publisher: "Reuters", domain: "reuters.com", publishedAt: D1 }),
      copy("dw", { publisher: "Deutsche Welle", domain: "dw.com", publishedAt: D2 }),
      copy("x", { publishedAt: D3, attributions: ["по данным Reuters"] }, { cites: ["DW"] }),
    ];
    assert.deepEqual(copyCites(copies[2]), ["DW", "по данным Reuters"]);
    assert.deepEqual(edge(build(copies), "x"), ["dw", "attribution", "probable"]);
  });

  it("объединение без повторов (без регистра и знаков) и без упоминаний самой копии", () => {
    const own = copy(
      "nm2",
      {
        publisher: "NewsMaker",
        domain: "newsmaker.md",
        attributions: ["сообщает NewsMaker", "по данным Reuters", "По данным  Reuters!"],
      },
      { cites: ["Reuters", "reuters"] },
    );
    assert.deepEqual(copyCites(own), ["Reuters", "по данным Reuters"]);
    // «сообщает NewsMaker» в статье NewsMaker — не ребро к более ранней статье NewsMaker
    const tree = build([
      copy("nm1", { publisher: "NewsMaker", domain: "newsmaker.md", publishedAt: D1 }),
      copy("nm2", {
        publisher: "NewsMaker",
        domain: "newsmaker.md",
        publishedAt: D2,
        attributions: ["сообщает NewsMaker"],
      }),
    ]);
    assert.deepEqual(edge(tree, "nm2"), [null, null, null]);
  });
});

describe("рёбра duplicate", () => {
  it("косинус ≥ 0.9 → родитель — более ранний, duplicate, probable; 0.9 включительно, 0.89 — нет", () => {
    const copies = [copy("b", { publishedAt: D2 }), copy("a", { publishedAt: D1 })];
    assert.deepEqual(edge(build(copies, sim(2, [[0, 1, 0.9]])), "b"), ["a", "duplicate", "probable"]);
    assert.deepEqual(edge(build(copies, sim(2, [[0, 1, 0.9]])), "a"), [null, null, null]);
    assert.deepEqual(edge(build(copies, sim(2, [[0, 1, 0.89]])), "b"), [null, null, null]);
  });

  it("нужны обе даты", () => {
    assert.deepEqual(duplicateEdges([copy("a", { publishedAt: D1 }), copy("b")], sim(2, [[0, 1, 0.99]])), []);
    assert.deepEqual(duplicateEdges([copy("a"), copy("b", { publishedAt: D2 })], sim(2, [[0, 1, 0.99]])), []);
  });

  it("из нескольких более ранних — самый похожий", () => {
    const copies = [
      copy("a", { publishedAt: D1 }),
      copy("b", { publishedAt: D2 }),
      copy("c", { publishedAt: D3 }),
    ];
    const tree = build(
      copies,
      sim(3, [
        [0, 2, 0.95],
        [1, 2, 0.97],
        [0, 1, 0.5],
      ]),
    );
    assert.deepEqual(edge(tree, "c"), ["b", "duplicate", "probable"]);
    assert.deepEqual(edge(tree, "b"), [null, null, null]);
  });

  it("равные даты — родитель тот, что раньше во входе; цикла нет", () => {
    const tree = build(
      [copy("a", { publishedAt: "2026-10-02" }), copy("b", { publishedAt: "2026-10-02T15:00:00Z" })],
      sim(2, [[0, 1, 0.95]]),
    );
    assert.deepEqual(edge(tree, "b"), ["a", "duplicate", "probable"]);
    assert.deepEqual(edge(tree, "a"), [null, null, null]);
  });

  it("шинглы: свой порог 0.5 — 0.6 это дубль, а для эмбеддингов — нет", () => {
    const copies = [copy("a", { publishedAt: D1 }), copy("b", { publishedAt: D2 })];
    assert.equal(duplicateEdges(copies, sim(2, [[0, 1, 0.6]], [], "shingles")).length, 1);
    assert.equal(duplicateEdges(copies, sim(2, [[0, 1, 0.6]], [], "embeddings")).length, 0);
  });
});

describe("один родитель", () => {
  const copies = (withLink: boolean, withCite: boolean) => [
    copy("l", { publishedAt: D1 }),
    copy("r", { publisher: "Reuters", publishedAt: D1 }),
    copy("d", { publishedAt: D1 }),
    copy(
      "x",
      { publishedAt: D2, outboundLinks: withLink ? [src("l").url] : [] },
      { cites: withCite ? ["Reuters"] : [] },
    ),
  ];
  const dup = sim(4, [[2, 3, 0.99]]);

  it("ссылка > атрибуция > дубль", () => {
    assert.deepEqual(edge(build(copies(true, true), dup), "x"), ["l", "link", "confirmed"]);
    assert.deepEqual(edge(build(copies(false, true), dup), "x"), ["r", "attribution", "probable"]);
    assert.deepEqual(edge(build(copies(false, false), dup), "x"), ["d", "duplicate", "probable"]);
  });

  it("взаимные ссылки без дат → ребро одно, цикла нет", () => {
    const tree = build([
      copy("a", { outboundLinks: [src("b").url] }),
      copy("b", { outboundLinks: [src("a").url] }),
    ]);
    assert.deepEqual(edge(tree, "a"), ["b", "link", "confirmed"]);
    assert.deepEqual(edge(tree, "b"), [null, null, null]);
  });

  it("кольцо из трёх ссылок → два ребра, у всех один корень ветки", () => {
    const tree = build([
      copy("a", { outboundLinks: [src("b").url] }),
      copy("b", { outboundLinks: [src("c").url] }),
      copy("c", { outboundLinks: [src("a").url] }),
    ]);
    const parentless = tree.nodes.filter((n) => n.id !== VIDEO_NODE_ID && n.parentId === null);
    assert.equal(parentless.length, 1);
    const top = parentless[0].id;
    assert.deepEqual(tree.voteGroups, { a: top, b: top, c: top });
  });

  it("дубль не перебивает ссылку и не замыкает с ней цикл", () => {
    // a ссылается на b (тот же день); по тексту a — «родитель» b, но ссылка надёжнее
    const tree = build(
      [
        copy("a", { publishedAt: "2026-10-02", outboundLinks: [src("b").url] }),
        copy("b", { publishedAt: D2 }),
      ],
      sim(2, [[0, 1, 0.99]]),
    );
    assert.deepEqual(edge(tree, "a"), ["b", "link", "confirmed"]);
    assert.deepEqual(edge(tree, "b"), [null, null, null]);
  });
});

// ---------- корень, группы, видео, порядок ----------

describe("корень и voteGroups", () => {
  it("цепочка ссылок: корень — самый ранний без родителя; группа ветки — её корень", () => {
    const tree = build([
      copy("p", { publishedAt: D3, outboundLinks: [src("dw").url] }),
      copy("dw", { publishedAt: D2, outboundLinks: [src("r").url] }),
      copy("r", { publishedAt: D1 }),
      copy("un"),
    ]);
    assert.equal(tree.rootId, "r");
    assert.deepEqual(tree.voteGroups, { p: "r", dw: "r", r: "r", un: "un" });
    assert.ok(!(VIDEO_NODE_ID in tree.voteGroups));
  });

  it("корнем не может быть копия без утверждения или без даты", () => {
    const tree = build([
      copy("noclaim", { publishedAt: "2020-01-01" }, { structure: null }),
      copy("undated"),
      copy("ok", { publishedAt: D2 }),
    ]);
    assert.equal(tree.rootId, "ok");
  });

  it("корень с родителем не бывает; подходящих нет → null", () => {
    assert.equal(build([copy("a"), copy("b", { publishedAt: D1 }, { structure: null })]).rootId, null);
    const tree = build([
      copy("x", { publishedAt: D1 }, { structure: null }),
      copy("y", { publishedAt: D2, outboundLinks: [src("x").url] }),
    ]);
    assert.equal(tree.rootId, null);
  });

  it("нет копий → только видео, корня нет, групп нет", () => {
    const tree = build([]);
    assert.equal(tree.rootId, null);
    assert.deepEqual(tree.voteGroups, {});
    assert.deepEqual(
      tree.nodes.map((n) => n.id),
      [VIDEO_NODE_ID],
    );
  });
});

describe("узел видео", () => {
  it("последний: id video, «Это видео», домен без www, дата и структура видео", () => {
    const structure: ClaimStructure = { ...S, time: { text: "вчера", date: "2026-10-02", relative: true } };
    const tree = build([copy("a", { publishedAt: D1 })], sim(1), {
      ...VIDEO,
      publishedAt: D3,
      structure,
    });
    assert.deepEqual(tree.nodes.at(-1), {
      id: VIDEO_NODE_ID,
      url: VIDEO.url,
      title: VIDEO.title,
      publisher: "Это видео",
      domain: "youtube.com",
      publishedAt: D3,
      parentId: null,
      via: null,
      confidence: null,
      structure,
    });
  });

  it("родитель — самая похожая копия с утверждением, не позже видео (у копии нужна дата)", () => {
    const copies = [
      copy("early", { publishedAt: D1 }),
      copy("late", { publishedAt: "2026-10-04T00:00:00Z" }),
      copy("noclaim", { publishedAt: D1 }, { structure: null }),
      copy("undated"),
      copy("mid", { publishedAt: D2 }),
    ];
    const tree = build(copies, sim(5, [], [0.5, 0.99, 0.98, 0.97, 0.7]), { ...VIDEO, publishedAt: D3 });
    assert.deepEqual(edge(tree, VIDEO_NODE_ID), ["mid", "duplicate", "probable"]);
  });

  it("видео без даты — подходит любая копия с утверждением, в том числе без даты", () => {
    const tree = build([copy("a", { publishedAt: D1 }), copy("b")], sim(2, [], [0.5, 0.8]));
    assert.deepEqual(edge(tree, VIDEO_NODE_ID), ["b", "duplicate", "probable"]);
  });

  it("похожесть 0 у всех → родителя нет", () => {
    const tree = build([copy("a", { publishedAt: D1 })], sim(1, [], [0]));
    assert.deepEqual(edge(tree, VIDEO_NODE_ID), [null, null, null]);
  });
});

describe("порядок узлов", () => {
  it("по дате, без даты — после датированных в порядке входа, видео — последним", () => {
    const tree = build([
      copy("u1"),
      copy("c", { publishedAt: D3 }),
      copy("u2"),
      copy("a", { publishedAt: D1 }),
      copy("b", { publishedAt: "2026-10-02" }),
      copy("bad", { publishedAt: "вчера" }),
    ]);
    assert.deepEqual(
      tree.nodes.map((n) => n.id),
      ["a", "b", "c", "u1", "u2", "bad", VIDEO_NODE_ID],
    );
    assert.ok(!("publishedAt" in node(tree, "bad")), "неразбираемая дата не попадает в узел");
  });
});

// ---------- вход без copies ----------

describe("copiesFromSources", () => {
  it("источник → копия: без ссылок и атрибуций, не из поиска раннего упоминания; без даты — без publishedAt", () => {
    const source: FoundSource = {
      id: "src_1",
      url: "https://www.dw.com/ru/a",
      title: "Заголовок",
      publisher: "Deutsche Welle",
      domain: "dw.com",
      sourceType: "news",
      publishedAt: D1,
      language: "ru",
      country: "DE",
      excerpt: "Текст",
      snippet: "Цитата",
      domainReliability: 0.9,
      retrievedAt: D3,
    };
    const { publishedAt: _, ...undated } = source;
    assert.deepEqual(copiesFromSources([source, { ...undated, id: "src_2" }]), [
      {
        id: "src_1",
        url: source.url,
        title: "Заголовок",
        publisher: "Deutsche Welle",
        domain: "dw.com",
        sourceType: "news",
        language: "ru",
        publishedAt: D1,
        excerpt: "Текст",
        outboundLinks: [],
        attributions: [],
        earliestSearch: false,
        retrievedAt: D3,
      },
      {
        id: "src_2",
        url: source.url,
        title: "Заголовок",
        publisher: "Deutsche Welle",
        domain: "dw.com",
        sourceType: "news",
        language: "ru",
        excerpt: "Текст",
        outboundLinks: [],
        attributions: [],
        earliestSearch: false,
        retrievedAt: D3,
      },
    ]);
  });
});

// ---------- похожесть ----------

const TEXT =
  "Правительство Молдовы объявило о повышении пенсий на десять процентов с первого января следующего года, " +
  "сообщили в министерстве труда и социальной защиты после заседания кабинета министров в Кишинёве во вторник";

describe("похожесть текстов", () => {
  it("шинглы — окна по 5 слов; короткий текст — один шингл", () => {
    assert.equal(shingles("раз два три четыре пять шесть").size, 2);
    assert.deepEqual([...shingles("Раз, два!")], ["раз два"]);
    assert.equal(shingles("").size, 0);
  });

  it("jaccard: одинаковые — 1, разные — 0, пустые — 0", () => {
    assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
    assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
    assert.equal(jaccard(new Set(), new Set()), 0);
  });

  it("шинглы: перепечатка с правкой одного слова ≥ 0.5, другой текст < 0.5; похожесть на утверждение — доля его слов", () => {
    const reprint = TEXT.replace("во вторник", "в среду");
    const other = "В Кишинёве прошёл фестиваль вина, на который приехали гости из двенадцати стран Европы";
    const s = shingleSimilarity("Пенсии в Молдове повысят на десять процентов", [TEXT, reprint, other]);
    assert.equal(s.method, "shingles");
    assert.ok(s.pairs[0][1] >= 0.5, String(s.pairs[0][1]));
    assert.ok(s.pairs[0][2] < 0.5, String(s.pairs[0][2]));
    // «в», «на», «десять», «процентов» есть в TEXT; «пенсии», «молдове», «повысят» — в других формах
    assert.ok(s.toClaim[0] > s.toClaim[2]);
  });

  it("эмбеддинги: косинус попарно и с утверждением", () => {
    assert.equal(cosine([1, 0], [0, 1]), 0);
    assert.ok(Math.abs(cosine([1, 1], [2, 2]) - 1) < 1e-12);
    assert.equal(cosine([0, 0], [1, 0]), 0);
    const s = embeddingSimilarity(
      [1, 0],
      [
        [1, 0],
        [0, 1],
      ],
    );
    assert.deepEqual(s.toClaim, [1, 0]);
    assert.deepEqual(s.pairs, [
      [1, 0],
      [0, 1],
    ]);
  });

  it("копии для LLM: сначала датированные, среди них — самые похожие; результат в порядке входа", () => {
    const sources = [
      src("u", { excerpt: "" }),
      src("d1", { publishedAt: D1 }),
      src("d2", { publishedAt: D2 }),
      src("d3", { publishedAt: D3 }),
    ];
    assert.deepEqual(pickForExtraction(sources, [0.99, 0.1, 0.5, 0.3], 2), [2, 3]);
    assert.deepEqual(pickForExtraction(sources, [0.99, 0.1, 0.5, 0.3], 10), [0, 1, 2, 3]);
  });
});
