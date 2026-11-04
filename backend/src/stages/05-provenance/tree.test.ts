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
  checkedRelation,
  citedKey,
  citeMatches,
  compareDates,
  copyCites,
  cosine,
  detailEdges,
  duplicateEdges,
  embeddingSimilarity,
  jaccard,
  linkEdges,
  pickForExtraction,
  rareShingles,
  shingles,
  sharedRareDetails,
  shingleSimilarity,
  siteLinkEdges,
  textReuseEdges,
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
        dateSource: "search",
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

describe("связи: названия крупных источников на разных языках", () => {
  const un = { publisher: "United Nations", domain: "www.un.org" };
  it("«по данным ООН», «conform Națiunilor Unite», «according to the United Nations» → un.org", () => {
    for (const cite of ["По данным ООН", "conform Națiunilor Unite", "according to the United Nations"]) {
      assert.ok(citeMatches(cite, un), cite);
    }
    assert.ok(citeMatches("По данным ЮНФПА", { publisher: "UNFPA", domain: "kyrgyzstan.unfpa.org" }));
  });
  it("румынское «un» (один) и посторонние источники — не ООН", () => {
    assert.ok(!citeMatches("un raport al poliției", un));
    assert.ok(!citeMatches("По данным мэрии", un));
  });
});

describe("siteLinkEdges: ссылка на другую страницу сайта из копий", () => {
  it("pravda → un.org/…/8-billion, в копиях un.org/en/dayof8billion → ребро к un.org", () => {
    const copies = [
      copy("un", {
        url: "https://www.un.org/en/dayof8billion",
        domain: "un.org",
        publishedAt: "2022-11-15T00:00:00Z",
      }),
      copy("pravda", {
        url: "https://www.pravda.com.ua/news/2022/11/15/1",
        domain: "pravda.com.ua",
        publishedAt: "2022-11-15T12:00:00Z",
        outboundLinks: ["https://www.un.org/en/desa/world-population-reach-8-billion-15-november-2022"],
      }),
    ];
    assert.deepEqual(siteLinkEdges(copies), [{ parent: 0, child: 1, via: "link", confidence: "probable" }]);
  });
  it("ссылка на свой же сайт и на более позднюю копию — не ребро", () => {
    const copies = [
      copy("a", { url: "https://a.md/1", domain: "a.md", publishedAt: "2022-11-16T00:00:00Z" }),
      copy("b", {
        url: "https://b.md/1",
        domain: "b.md",
        publishedAt: "2022-11-15T00:00:00Z",
        outboundLinks: ["https://b.md/2", "https://a.md/other"],
      }),
    ];
    assert.deepEqual(siteLinkEdges(copies), []);
  });
});

describe("дерево при TRACE_SEARCH=on", () => {
  const nums = (...values: string[]): ClaimStructure => ({
    ...S,
    numbers: values.map((value) => ({ value, about: "см" })),
    places: [],
  });
  const dated = (day: string) => ({ publishedAt: `2026-10-${day}T10:00:00Z` });

  it("разбор, который ссылается на фейк, — отдельный голос", () => {
    const fake = copy("fake", dated("01"));
    const check = copy(
      "check",
      { ...dated("02"), outboundLinks: [fake.source.url] },
      { relation: "debunks" },
    );
    const similarity = sim(2, [], [0, 0]);
    const off = buildTree({ claimId: "c", copies: [fake, check], video: VIDEO, similarity });
    const on = buildTree({ claimId: "c", copies: [fake, check], video: VIDEO, similarity, traceMode: true });
    assert.equal(off.voteGroups.check, off.voteGroups.fake);
    assert.notEqual(on.voteGroups.check, on.voteGroups.fake);
  });

  it("перепечатка разбора остаётся в группе разбора", () => {
    const check = copy("check", dated("02"), { relation: "debunks" });
    const reprint = copy(
      "reprint",
      { ...dated("03"), outboundLinks: [check.source.url] },
      { relation: "debunks" },
    );
    const tree = buildTree({
      claimId: "c",
      copies: [check, reprint],
      video: VIDEO,
      similarity: sim(2, [], [0, 0]),
      traceMode: true,
    });
    assert.equal(tree.voteGroups.reprint, tree.voteGroups.check);
  });

  it("две заметки по одному не найденному источнику — один голос", () => {
    const a = copy("a", dated("01"), { cites: ["мэрия Кишинёва"] });
    const b = copy("b", dated("02"), { cites: ["по данным мэрии Кишинёва"] });
    const similarity = sim(2, [], [0, 0]);
    const off = buildTree({ claimId: "c", copies: [a, b], video: VIDEO, similarity });
    const on = buildTree({ claimId: "c", copies: [a, b], video: VIDEO, similarity, traceMode: true });
    assert.notEqual(off.voteGroups.a, off.voteGroups.b);
    assert.equal(on.voteGroups.a, on.voteGroups.b);
  });

  it("«очевидцы» голоса не объединяют", () => {
    const a = copy("a", dated("01"), { cites: ["очевидцы"] });
    const b = copy("b", dated("02"), { cites: ["очевидцы"] });
    const tree = buildTree({
      claimId: "c",
      copies: [a, b],
      video: VIDEO,
      similarity: sim(2, [], [0, 0]),
      traceMode: true,
    });
    assert.notEqual(tree.voteGroups.a, tree.voteGroups.b);
  });

  it("общая редкая цифра важнее похожего текста", () => {
    const copies = [
      copy("orig", dated("01"), { structure: nums("10") }),
      copy("mut", dated("02"), { structure: nums("30") }),
      copy("other", dated("03"), { structure: nums("10") }),
      copy("other2", dated("03"), { structure: nums("10") }),
      copy("other3", dated("03"), { structure: nums("10") }),
      copy("child", dated("04"), { structure: nums("30") }),
    ];
    const shared = sharedRareDetails(copies);
    assert.equal(shared(1, 5), 1);
    assert.equal(shared(0, 2), 0);
    const similarity = sim(
      6,
      [
        [0, 5, 0.97],
        [1, 5, 0.91],
      ],
      [0, 0, 0, 0, 0, 0],
    );
    const edges = duplicateEdges(copies, similarity, shared).filter((e) => e.child === 5);
    assert.equal(edges[0].parent, 1);
  });

  it("две редкие детали дают ребро и без похожего текста: перевод", () => {
    const structure = (...places: string[]): ClaimStructure => ({
      ...S,
      numbers: [{ value: "77", about: "x" }],
      places,
    });
    const copies = [
      copy("ro", dated("01"), { structure: structure("Деренеу") }),
      copy("ru", dated("02"), { structure: structure("Деренеу") }),
      copy("x", dated("02"), { structure: nums("1") }),
      copy("y", dated("02"), { structure: nums("2") }),
      copy("z", dated("02"), { structure: nums("3") }),
      copy("w", dated("02"), { structure: nums("4") }),
    ];
    const edges = detailEdges(copies, sharedRareDetails(copies));
    assert.deepEqual(
      edges.map((e) => [e.parent, e.child]),
      [[0, 1]],
    );
    assert.equal(edges[0].confidence, "probable");
  });

  it("ключ источника не зависит от падежа", () => {
    assert.equal(citedKey("по данным мэрии Кишинёва"), citedKey("мэрия Кишинёва"));
  });

  it("ранняя копия читается первой, даже если меньше похожа", () => {
    const list = [
      { publishedAt: "2026-10-01" },
      { publishedAt: "2026-10-01" },
      { publishedAt: "2026-10-01", earliestSearch: true },
    ];
    assert.deepEqual(pickForExtraction(list, [0.9, 0.8, 0.1], 2, true), [0, 2]);
  });
});

describe("корень и связи: история, а не только утверждение", () => {
  const D = (day: string) => ({ publishedAt: `2026-05-${day}T10:00:00Z` });
  const text = (seed: string) =>
    Array.from({ length: 60 }, (_, i) => `${seed}${i} слово${i} текст${i} часть${i} строка${i}`).join(" ");

  it("исходное событие с другими словами становится корнем", () => {
    const origin = copy("origin", D("01"), { relation: "source_event" });
    const fake = copy("fake", D("05"), { relation: "repeats" });
    assert.equal(
      buildTree({ claimId: "c", copies: [origin, fake], video: VIDEO, similarity: sim(2), traceMode: true })
        .rootId,
      "origin",
    );
  });

  it("разбор не становится корнем, даже если он самый ранний", () => {
    const check = copy("check", D("01"), { relation: "debunks" });
    const fake = copy("fake", D("05"), { relation: "repeats" });
    assert.equal(
      buildTree({ claimId: "c", copies: [check, fake], video: VIDEO, similarity: sim(2), traceMode: true })
        .rootId,
      "fake",
    );
  });

  it("только разборы: корня нет, а не ложный корень", () => {
    const check = copy("check", D("01"), { relation: "debunks" });
    assert.equal(
      buildTree({ claimId: "c", copies: [check], video: VIDEO, similarity: sim(1), traceMode: true }).rootId,
      null,
    );
  });

  it("разбор, ссылающийся на статью, не показывается её пересказом", () => {
    const article = copy("article", D("01"), { relation: "repeats" });
    const check = copy("check", { ...D("02"), outboundLinks: [article.source.url] }, { relation: "debunks" });
    const tree = buildTree({
      claimId: "c",
      copies: [article, check],
      video: VIDEO,
      similarity: sim(2),
      traceMode: true,
    });
    assert.equal(node(tree, "check").parentId, null);
    assert.equal(node(tree, "check").relation, "debunks");
  });

  it("видео не берёт разбор в родители", () => {
    const check = copy("check", D("01"), { relation: "debunks" });
    const fake = copy("fake", D("02"), { relation: "repeats" });
    const tree = buildTree({
      claimId: "c",
      copies: [check, fake],
      video: VIDEO,
      similarity: sim(2, [], [0.9, 0.2]),
      traceMode: true,
    });
    assert.equal(node(tree, VIDEO_NODE_ID).parentId, "fake");
  });

  it("дословная перепечатка находится по полному тексту, а не по выдержке", () => {
    const body = text("общий");
    const a = copy("a", { ...D("01"), fullText: body });
    const b = copy("b", { ...D("02"), fullText: `${body} ${text("своё")}` });
    assert.deepEqual(
      textReuseEdges([a, b]).map((e) => [e.parent, e.child]),
      [[0, 1]],
    );
  });

  it("разные тексты перепечаткой не считаются", () => {
    const a = copy("a", { ...D("01"), fullText: text("один") });
    const b = copy("b", { ...D("02"), fullText: text("два") });
    assert.deepEqual(textReuseEdges([a, b]), []);
  });

  it("одинаковый текст на одном сайте распространением не считается", () => {
    const body = text("общий");
    const a = copy("a", { ...D("01"), fullText: body, domain: "site.example" });
    const b = copy("b", { ...D("02"), fullText: body, domain: "site.example" });
    const tree = buildTree({
      claimId: "c",
      copies: [a, b],
      video: VIDEO,
      similarity: sim(2),
      traceMode: true,
    });
    assert.equal(node(tree, "b").parentId, null);
  });
});

describe("корень — верх самой ранней ветви", () => {
  const D = (day: string) => ({ publishedAt: `2026-05-${day}T10:00:00Z` });

  it("родитель без даты важнее поздней страницы без родителя", () => {
    const origin = copy("origin", {}, { relation: "repeats" });
    const a = copy("a", { ...D("05"), outboundLinks: [origin.source.url] }, { relation: "repeats" });
    const late = copy("late", D("20"), { relation: "repeats" });
    const tree = buildTree({
      claimId: "c",
      copies: [origin, a, late],
      video: VIDEO,
      similarity: sim(3),
      traceMode: true,
    });
    assert.equal(tree.rootId, "origin");
  });
});

describe("разбор определяет и код", () => {
  const page = (domain: string, title: string) => ({ domain, title, sourceType: "news" as const });

  it("домен фактчекера важнее ответа LLM", () => {
    assert.equal(checkedRelation(page("mythdetector.com", "The Original Source"), "repeats"), "debunks");
  });

  it("заголовок разбора важнее ответа LLM", () => {
    assert.equal(checkedRelation(page("x.md", "Фейк о покупке"), "repeats"), "debunks");
  });

  it("обычная публикация сохраняет ответ LLM", () => {
    assert.equal(checkedRelation(page("rg.ru", "Майю Санду обвинили"), "repeats"), "repeats");
  });

  it("в режиме без типов связей ничего не меняется", () => {
    assert.equal(checkedRelation(page("mythdetector.com", "Фейк"), undefined), undefined);
  });
});

describe("надёжный корень", () => {
  const at = (date: string, over: Partial<SourceCopy> = {}) => ({
    publishedAt: date,
    dateSource: "page" as const,
    ...over,
  });
  const tree = (copies: CopyFacts[]) =>
    buildTree({ claimId: "c", copies, video: VIDEO, similarity: sim(copies.length), traceMode: true });

  it("дата только от поисковика не даёт стать корнем", () => {
    const wrong = copy(
      "wrong",
      { publishedAt: "2025-02-10T00:00:00Z", dateSource: "search" },
      { relation: "repeats" },
    );
    const real = copy("real", at("2025-08-01T00:00:00Z"), { relation: "repeats" });
    assert.equal(tree([wrong, real]).rootId, "real");
  });

  it("только даты поисковика: корня нет", () => {
    const a = copy(
      "a",
      { publishedAt: "2025-02-10T00:00:00Z", dateSource: "search" },
      { relation: "repeats" },
    );
    assert.equal(tree([a]).rootId, null);
  });

  it("предыстория без связи не становится началом свежего эпизода", () => {
    const copies = [
      copy("old", at("2019-04-30T00:00:00Z"), { relation: "repeats" }),
      copy("a", at("2026-01-30T00:00:00Z"), { relation: "repeats" }),
      copy("b", at("2026-02-02T00:00:00Z"), { relation: "repeats" }),
      copy("c", at("2026-02-09T00:00:00Z"), { relation: "repeats" }),
    ];
    const result = tree(copies);
    assert.equal(result.rootId, "a");
    assert.ok(
      result.nodes.some((n) => n.id === "old"),
      "предыстория остаётся на таймлайне",
    );
  });

  it("старая новость без свежего всплеска остаётся корнем: это и есть старый контент", () => {
    const copies = [
      copy("old", at("2021-01-10T00:00:00Z"), { relation: "repeats" }),
      copy("a", at("2026-10-01T00:00:00Z"), { relation: "repeats" }),
    ];
    assert.equal(tree(copies).rootId, "old");
  });

  it("старая страница со ссылкой из свежих копий остаётся корнем", () => {
    const old = copy("old", at("2021-01-10T00:00:00Z"), { relation: "repeats" });
    const copies = [
      old,
      copy("a", at("2026-10-01T00:00:00Z", { outboundLinks: [old.source.url] }), { relation: "repeats" }),
      copy("b", at("2026-10-02T00:00:00Z"), { relation: "repeats" }),
      copy("c", at("2026-10-03T00:00:00Z"), { relation: "repeats" }),
    ];
    assert.equal(tree(copies).rootId, "old");
  });
});

describe("редкие фрагменты текста", () => {
  it("фрагмент почти у всех копий считается шаблоном", () => {
    const sets = [1, 2, 3, 4, 5].map((i) => new Set(["шаблон сайта", `своё ${i}`]));
    sets[0].add("редкое");
    sets[1].add("редкое");
    const rare = rareShingles(sets);
    assert.equal(rare[0].has("шаблон сайта"), false);
    assert.equal(rare[0].has("редкое"), true);
  });

  it("мало копий: частоту не считаем", () => {
    const sets = [new Set(["а"]), new Set(["а"])];
    assert.equal(rareShingles(sets)[0].has("а"), true);
  });
});

describe("узел «источник не найден»", () => {
  const dated = (day: string) => ({ publishedAt: `2026-10-${day}T10:00:00Z`, dateSource: "page" as const });

  it("две копии с одним не найденным источником дают скрытый узел", () => {
    const a = copy("a", dated("01"), { cites: ["мэрия Кишинёва"], relation: "repeats" });
    const b = copy("b", dated("02"), { cites: ["по данным мэрии Кишинёва"], relation: "repeats" });
    const tree = buildTree({
      claimId: "c",
      copies: [a, b],
      video: VIDEO,
      similarity: sim(2),
      traceMode: true,
    });
    assert.deepEqual(tree.hiddenSources?.[0]?.copyIds, ["a", "b"]);
    assert.equal(tree.hiddenSources?.[0]?.name, "мэрия Кишинёва");
  });

  it("одна копия скрытого узла не создаёт", () => {
    const a = copy("a", dated("01"), { cites: ["мэрия Кишинёва"], relation: "repeats" });
    const tree = buildTree({ claimId: "c", copies: [a], video: VIDEO, similarity: sim(1), traceMode: true });
    assert.equal(tree.hiddenSources, undefined);
  });
});

describe("скрытый источник — только имя собственное", () => {
  it("обрывки фразы не объединяют голоса и не создают узел", () => {
    const dated = (day: string) => ({ publishedAt: `2026-10-${day}T10:00:00Z`, dateSource: "page" as const });
    const a = copy("a", dated("01"), { cites: ["lui"], relation: "repeats" });
    const b = copy("b", dated("02"), { cites: ["украинский посол в"], relation: "repeats" });
    const c = copy("c", dated("03"), { cites: ["lui"], relation: "repeats" });
    const tree = buildTree({
      claimId: "c",
      copies: [a, b, c],
      video: VIDEO,
      similarity: sim(3),
      traceMode: true,
    });
    assert.equal(tree.hiddenSources, undefined);
    assert.notEqual(tree.voteGroups.a, tree.voteGroups.c);
  });
});

describe("заимствование внутри длинной статьи", () => {
  const dated = (day: string) => ({ publishedAt: `2026-10-${day}T10:00:00Z` });
  const unique = (seed: string, n: number) => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");

  it("общий абзац находится, даже если это малая часть страницы", () => {
    const quote = unique("цитата", 40);
    const a = copy("a", { ...dated("01"), fullText: `${unique("своё", 2000)} ${quote}` });
    const b = copy("b", { ...dated("02"), fullText: `${quote} ${unique("другое", 2000)}` });
    assert.deepEqual(
      textReuseEdges([a, b]).map((e) => [e.parent, e.child]),
      [[0, 1]],
    );
  });

  it("короткая общая формула ребра не даёт", () => {
    const phrase = unique("конвенция", 12);
    const a = copy("a", { ...dated("01"), fullText: `${unique("а", 300)} ${phrase}` });
    const b = copy("b", { ...dated("02"), fullText: `${phrase} ${unique("б", 300)}` });
    assert.deepEqual(textReuseEdges([a, b]), []);
  });

  it("служебная разметка PDF не считается заимствованием", () => {
    const body = unique("obj", 100);
    const a = copy("a", { ...dated("01"), url: "https://a.example/file.pdf", fullText: body });
    const b = copy("b", { ...dated("02"), fullText: body });
    assert.deepEqual(textReuseEdges([a, b]), []);
  });
});
