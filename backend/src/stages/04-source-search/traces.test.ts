import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Claim } from "../03-claim-extraction/types.ts";
import {
  claimNumbers,
  dateFromHtml,
  extraQueries,
  isListingPage,
  protectEarly,
  queriesByLanguage,
} from "./copies.ts";
import { RateWindow } from "./engines.ts";
import { htmlToMarkdown } from "./pages.ts";
import type { PlannedQuery } from "./queries.ts";
import { SAME_STORY_SYSTEM } from "./same-event.ts";
import { expandScale, mentionsNumber } from "./sufficiency.ts";
import { keywordStems } from "./text.ts";
import {
  citedName,
  claimPassages,
  exactQuery,
  isSourceName,
  openCitations,
  openLanguages,
  openLinks,
  quotedPhrases,
  withoutNumbers,
} from "./traces.ts";
import type { SourceCopy } from "./types.ts";

function copy(id: string, over: Partial<SourceCopy> = {}): SourceCopy {
  return {
    id,
    url: `https://${id}.example/news/${id}`,
    title: id,
    publisher: id,
    domain: `${id}.example`,
    sourceType: "news",
    language: "ru",
    excerpt: "",
    outboundLinks: [],
    attributions: [],
    earliestSearch: false,
    retrievedAt: "2026-11-04T00:00:00Z",
    ...over,
  };
}

const query = (text: string, language: string, intent: PlannedQuery["intent"] = "confirm"): PlannedQuery => ({
  text,
  language,
  intent,
  freshness: "any",
});

describe("следы: что ещё можно проверить", () => {
  it("ссылка на страницу вне копий — открытый след, самая частая первой", () => {
    const copies = [
      copy("a", { outboundLinks: ["https://gov.md/doc/1", "https://x.md/2"] }),
      copy("b", { outboundLinks: ["https://gov.md/doc/1"] }),
    ];
    assert.deepEqual(openLinks(copies, new Set()), ["https://gov.md/doc/1", "https://x.md/2"]);
  });

  it("ссылка на уже найденную копию следом не считается", () => {
    const copies = [copy("a", { outboundLinks: ["https://www.b.example/news/b/"] }), copy("b")];
    assert.deepEqual(openLinks(copies, new Set()), []);
  });

  it("проверенный след второй раз не открывается: поиск не зацикливается", () => {
    const copies = [copy("a", { outboundLinks: ["https://gov.md/doc/1"] })];
    assert.deepEqual(openLinks(copies, new Set(["gov.md/doc/1"])), []);
  });

  it("названный источник, которого нет среди копий, — след", () => {
    const copies = [copy("a", { attributions: ["по данным мэрии Кишинёва"] })];
    assert.deepEqual(openCitations(copies, new Set()), ["мэрии Кишинёва"]);
  });

  it("источник, который уже есть среди копий, следом не считается", () => {
    const copies = [
      copy("a", { attributions: ["сообщает Reuters"] }),
      copy("reuters", { publisher: "Reuters" }),
    ];
    assert.deepEqual(openCitations(copies, new Set()), []);
  });

  it("«очевидцы» и «источники» не дают следа: искать нечего", () => {
    const copies = [copy("a", { attributions: ["по данным источников", "по словам очевидцев"] })];
    assert.deepEqual(openCitations(copies, new Set()), []);
  });

  it("новая более старая копия снова открывает поиск на языке", () => {
    const searched = new Map([["ro", "2026-05-01T00:00:00Z"]]);
    assert.deepEqual(openLanguages(["ro"], "2026-05-01T00:00:00Z", searched), []);
    assert.deepEqual(openLanguages(["ro"], "2026-04-01T00:00:00Z", searched), ["ro"]);
  });

  it("без дат искать раньше нечего", () => {
    assert.deepEqual(openLanguages(["ro"], undefined, new Map()), []);
  });
});

describe("поиск первоисточника с другими числами", () => {
  it("из запроса уходят числа: у оригинала цифра может быть другой", () => {
    assert.equal(withoutNumbers("Osmochescu 300 mii imigranți 2026"), "Osmochescu mii imigranți");
  });

  it("фильтр события не считает другое число другим событием", () => {
    assert.match(SAME_STORY_SYSTEM, /другое число само по себе НЕ/);
  });

  it("запросы покрывают все языки, а не первые три по порядку", () => {
    const picked = queriesByLanguage(
      [query("a", "ru"), query("b", "ru"), query("c", "ru"), query("d", "ro"), query("e", "en")],
      3,
    );
    assert.deepEqual(
      picked.map((q) => q.language),
      ["ru", "ro", "en"],
    );
  });

  it("запрос на опровержение в поиск копий не идёт", () => {
    assert.deepEqual(queriesByLanguage([query("a", "ru", "refute")], 3), []);
  });

  it("ранняя копия с низкой релевантностью не выпадает из отбора", () => {
    const items = [
      { id: "old", base: 0.1, early: true },
      { id: "x", base: 0.9, early: false },
      { id: "y", base: 0.8, early: false },
    ];
    assert.deepEqual(
      protectEarly(items, 2).map((i) => i.id),
      ["old", "x"],
    );
  });
});

describe("ссылки только рядом с утверждением", () => {
  const stems = keywordStems("мэрия Кишинёва закрыла рынок");
  const page = [
    "Мэрия Кишинёва закрыла рынок, сообщили [в примэрии](https://chisinau.md/doc/1).",
    "Подробнее [в решении](https://chisinau.md/doc/2).",
    "Читайте также",
    "[Новости спорта](https://sport.example/news/1)",
  ].join("\n\n");

  it("боковая лента не считается ссылкой на источник", () => {
    const text = claimPassages(page, stems);
    assert.match(text, /chisinau\.md\/doc\/1/);
    assert.match(text, /chisinau\.md\/doc\/2/);
    assert.doesNotMatch(text, /sport\.example/);
  });
});

describe("имя источника", () => {
  it("убирает слово-маркер", () => {
    assert.equal(citedName("potrivit Ministerului Economiei"), "Ministerului Economiei");
  });
});

describe("имя источника, а не обрывок фразы", () => {
  it("настоящие названия проходят", () => {
    assert.ok(isSourceName("Reuters"));
    assert.ok(isSourceName("Ministerului Economiei"));
  });

  it("обрывки не проходят: такие следы вели на мусор в живом прогоне", () => {
    for (const bad of ["the press", "lui", "a press release issued by", "независимость"]) {
      assert.equal(isSourceName(bad), false, bad);
    }
    assert.equal(isSourceName("European officials cited by the Bloomberg agency"), false);
  });
});

describe("страница, открытая локально", () => {
  const html = `<html><header><a href="https://menu.example/news/1">меню</a></header>
    <article><p>Мэрия Кишинёва закрыла рынок, <a href="https://chisinau.md/doc/1">решение</a>.</p>
    <aside><a href="https://sport.example/news/1">спорт</a></aside></article>
    <footer><a href="https://footer.example/news/1">подвал</a></footer></html>`;

  it("остаётся текст статьи со ссылками, без меню и боковых колонок", () => {
    const markdown = htmlToMarkdown(html);
    assert.match(markdown, /\[решение\]\(https:\/\/chisinau\.md\/doc\/1\)/);
    assert.doesNotMatch(markdown, /menu\.example|sport\.example|footer\.example/);
  });

  it("дата из разметки отдельно от даты правки", () => {
    assert.equal(dateFromHtml('{"dateModified":"2026-10-03T00:00:00Z"}', false), undefined);
    assert.equal(dateFromHtml('{"datePublished":"2025-08-07T00:00:00Z"}', false), "2025-08-07T00:00:00.000Z");
  });
});

describe("дата — не число для проверки", () => {
  const base = { normalized: "", quote: "" } as unknown as Claim;
  const structure = (over: object) => ({
    event: "",
    numbers: [],
    places: [],
    time: null,
    certainty: "asserted",
    certaintyMarkers: [],
    attributedTo: null,
    ...over,
  });

  it("день голосования не требует подтверждения как величина", () => {
    const claim = {
      ...base,
      structure: structure({
        numbers: [{ value: "14", about: "дата голосования" }],
        time: { text: "14 октября 2021 года", date: "2021-10-14", relative: false },
      }),
    } as Claim;
    assert.deepEqual(claimNumbers(claim), []);
  });

  it("настоящая величина остаётся", () => {
    const claim = {
      ...base,
      structure: structure({
        numbers: [{ value: "200", about: "пострадавших" }],
        time: { text: "14 октября", date: null, relative: false },
      }),
    } as Claim;
    assert.deepEqual(claimNumbers(claim), ["200"]);
  });
});

describe("частота запросов", () => {
  it("лишний запрос ждёт, пока освободится место в окне", () => {
    const window = new RateWindow(2, 1000);
    assert.equal(window.reserve(0), 0);
    assert.equal(window.reserve(10), 0);
    assert.equal(window.reserve(20), 980);
    assert.equal(window.reserve(1500), 0);
  });
});

describe("страницы-ленты", () => {
  it("поиск, теги и архивы не считаются публикациями", () => {
    assert.ok(isListingPage("https://esp.md/ru/search/content/%D0%9D"));
    assert.ok(isListingPage("https://stiripesurse.md/tag/osmochescu-migranti"));
    assert.ok(isListingPage("https://site.md/?s=dereneu"));
  });

  it("обычная статья проходит", () => {
    assert.equal(isListingPage("https://newsmaker.md/ru/moldova-ratifitsirovala-stambulskuyu"), false);
  });
});

describe("разные типы запросов", () => {
  it("цитата становится точным запросом", () => {
    assert.equal(
      exactQuery("«государство силой отобрало храм у верующих»"),
      '"государство силой отобрало храм у верующих"',
    );
  });

  it("слишком короткая цитата точным запросом не становится", () => {
    assert.equal(exactQuery("отобрали храм"), null);
  });

  it("добавляет цитату и связку имён с числами, без повторов", () => {
    const claim = {
      quote: "министр заявил о трёхстах тысячах работников",
      normalized: "300 тысяч работников",
      entities: ["Осмокеску", "Молдова"],
      language: "ru",
    } as unknown as Claim;
    const texts = extraQueries(claim, [query("Осмокеску Молдова 300", "ru")]).map((q) => q.text);
    assert.deepEqual(texts, ['"министр заявил о трёхстах тысячах работников"']);
  });

  it("цитаты из копий дают запросы, самая частая первой", () => {
    const quote = "«не хватает трёхсот тысяч человек на рынке труда»";
    const copies = [copy("a", { excerpt: quote }), copy("b", { excerpt: quote })];
    assert.deepEqual(quotedPhrases(copies, new Set()), ["не хватает трёхсот тысяч человек на рынке труда"]);
  });

  it("уже проверенная цитата не повторяется", () => {
    const phrase = "не хватает трёхсот тысяч человек на рынке труда";
    assert.deepEqual(quotedPhrases([copy("a", { excerpt: `«${phrase}»` })], new Set([phrase])), []);
  });
});

describe("одно число в разной записи", () => {
  it("тысячи и миллионы разворачиваются на разных языках", () => {
    assert.equal(expandScale("не хватает 300 тысяч человек"), "не хватает 300000 человек");
    assert.equal(expandScale("300 de mii de lucrători"), "300000 de lucrători");
    assert.equal(expandScale("3.5 млн леев"), "3500000 леев");
  });

  it("длинное число подтверждается и без слов рядом: они могут быть на другом языке", () => {
    assert.ok(mentionsNumber("Moldova 300000 de lucrători", "300000", ["иммигрант"]));
  });

  it("короткому числу по-прежнему нужны слова рядом", () => {
    assert.equal(mentionsNumber("в 200 метрах от рынка", "200", ["пострадавш"]), false);
  });
});
