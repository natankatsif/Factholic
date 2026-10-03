import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LanguageCode, SourceType } from "@news/contracts";
import type { Candidate } from "./engines.ts";
import type { QueryIntent } from "./queries.ts";
import { dedupe, enrich, registrableDomain, selectDiverse, toFoundSource, type Enriched } from "./select.ts";
import { keywordStems } from "./text.ts";

function candidate(over: Partial<Candidate> & Pick<Candidate, "url">): Candidate {
  return {
    title: "Заголовок",
    text: "Текст страницы",
    relevance: 0.5,
    language: "ru",
    queries: [{ text: "запрос", intent: "confirm" }],
    fallbackType: "other",
    ...over,
  };
}

const claimStems = keywordStems("На территории Украины идёт война.", "Украина");

describe("dedupe", () => {
  it("один URL в разных написаниях схлопывается: www, слэш, utm_/fbclid/gclid, #якорь, http/https", () => {
    const variants = [
      "https://www.reuters.com/world/ukraine/",
      "https://reuters.com/world/ukraine",
      "http://reuters.com/world/ukraine?utm_source=x&utm_medium=y",
      "https://reuters.com/world/ukraine?fbclid=abc",
      "https://reuters.com/world/ukraine?gclid=abc#comments",
    ];
    const result = dedupe(variants.map((url, i) => candidate({ url, relevance: 0.1 * (i + 1) })));
    assert.equal(result.length, 1);
  });

  it("при дубле оставляет поля лучшего по relevance и объединяет запросы обоих", () => {
    const [merged] = dedupe([
      candidate({
        url: "https://reuters.com/a",
        title: "слабый",
        relevance: 0.3,
        queries: [{ text: "война в Украине", intent: "confirm" }],
      }),
      candidate({
        url: "https://www.reuters.com/a/",
        title: "сильный",
        relevance: 0.9,
        queries: [{ text: "Ukraine war fact check", intent: "refute" }],
      }),
      candidate({
        url: "https://reuters.com/a",
        title: "средний",
        relevance: 0.5,
        queries: [{ text: "war in Ukraine", intent: "context" }],
      }),
    ]);
    assert.equal(merged.title, "сильный");
    assert.equal(merged.relevance, 0.9);
    assert.deepEqual(
      merged.queries.map((q) => q.intent),
      ["confirm", "refute", "context"],
    );
  });

  it("разные пути и разные значимые параметры — разные страницы", () => {
    const result = dedupe([
      candidate({ url: "https://reuters.com/a" }),
      candidate({ url: "https://reuters.com/b" }),
      candidate({ url: "https://reuters.com/a?id=1" }),
      candidate({ url: "https://reuters.com/a?id=2" }),
    ]);
    assert.equal(result.length, 4);
  });

  it("битые и не-http(s) ссылки отбрасываются", () => {
    const result = dedupe([
      candidate({ url: "не ссылка" }),
      candidate({ url: "ftp://example.com/file" }),
      candidate({ url: "javascript:alert(1)" }),
      candidate({ url: "https://example.com/ok" }),
    ]);
    assert.deepEqual(
      result.map((c) => c.url),
      ["https://example.com/ok"],
    );
  });
});

describe("enrich", () => {
  const onTopic =
    "Война в Украине продолжается: боевые действия идут на нескольких направлениях, сообщают военные.";

  it("страница не по теме (совпало < 25% ключевых слов) → null", () => {
    const c = candidate({
      url: "https://zz-blog.com/borscht",
      title: "Лучший рецепт борща",
      text: "Свёклу натереть на крупной тёрке, обжарить с морковью и луком минут десять.",
      queries: [{ text: "война в Украине", intent: "confirm" }],
    });
    assert.equal(enrich(c, claimStems), null);
  });

  it("страница на другом языке засчитывается по словам запроса на её языке", () => {
    const c = candidate({
      url: "https://zz-news.com/ukraine",
      title: "Ukraine war latest",
      text: "Fighting continued along the front line in Ukraine overnight, officials said, as the war goes on.",
      language: "en",
      queries: [{ text: "war in Ukraine latest", intent: "confirm" }],
    });
    assert.equal(enrich({ ...c, queries: [] }, ["заведомо", "мимо"]), null);
    const e = enrich(c, claimStems);
    assert.ok(e);
    assert.equal(e.match, 1);
    assert.equal(e.language, "en");
  });

  it("язык страницы определяется по тексту, а не по языку запроса", () => {
    const e = enrich(
      candidate({ url: "https://zz-news.com/ru", text: onTopic, language: "en", queries: [] }),
      claimStems,
    );
    assert.equal(e?.language, "ru");
  });

  it("неизвестный домен: издатель из хвоста заголовка «… – Издание»", () => {
    const e = enrich(
      candidate({
        url: "https://www.zz-kyiv-news.com.ua/war",
        title: "Війна в Україні – Kyiv News",
        text: onTopic,
      }),
      claimStems,
    );
    assert.ok(e);
    assert.equal(e.domain, "zz-kyiv-news.com.ua");
    assert.equal(e.info.publisher, "Kyiv News");
    assert.equal(e.info.country, "UA");
  });

  it("хвост заголовка, не похожий на домен, издателем не считается", () => {
    const e = enrich(
      candidate({ url: "https://zz-site.com/x", title: "Война в Украине - главное за сутки", text: onTopic }),
      claimStems,
    );
    assert.equal(e?.info.publisher, "zz-site.com");
  });

  it("неизвестный домен без издателя в заголовке → издатель = домен", () => {
    const e = enrich(
      candidate({ url: "https://zz-site.com/x", title: "Война в Украине", text: onTopic }),
      claimStems,
    );
    assert.equal(e?.info.publisher, "zz-site.com");
  });

  it("известный домен: издатель из справочника, а не из заголовка", () => {
    const e = enrich(
      candidate({
        url: "https://www.reuters.com/x",
        title: "Война в Украине | Какой-то сайт",
        text: onTopic,
      }),
      claimStems,
    );
    assert.equal(e?.info.publisher, "Reuters");
  });

  it("разбор фактчекера (preset): тип fact_checker, готовые excerpt/snippet/издатель, язык не переопределяется", () => {
    const e = enrich(
      candidate({
        url: "https://zz-checker.org/review/1",
        title: "Нет, война в Украине не закончилась",
        text: "Проверяемое утверждение: «Война в Украине закончилась». Ложь.",
        language: "en",
        fallbackType: "fact_checker",
        preset: { publisher: "ZZ Check", excerpt: "готовый excerpt", snippet: "Ложь: заголовок" },
      }),
      claimStems,
    );
    assert.ok(e);
    assert.equal(e.info.type, "fact_checker");
    assert.equal(e.info.publisher, "ZZ Check");
    assert.equal(e.excerpt, "готовый excerpt");
    assert.equal(e.snippet, "Ложь: заголовок");
    assert.equal(e.language, "en");
  });

  it("excerpt и snippet вырезаются из текста по ключевым словам", () => {
    const text = [
      "Меню сайта и прочие ссылки на разделы, не относящиеся к делу никак.",
      onTopic,
      "Подписывайтесь на наш канал, чтобы не пропустить свежие публикации.",
    ].join("\n\n");
    const e = enrich(candidate({ url: "https://zz-site.com/x", text }), claimStems);
    assert.equal(e?.excerpt, onTopic);
    assert.equal(e?.snippet, onTopic);
  });

  it("одно общее слово — не тема: нужно ≥ 2 совпавших основ, даже если доля ≥ 25%", () => {
    // claimStems: террит/украи/идет/война — совпадает только «Украина» (1 из 4 = 25%)
    const c = candidate({
      url: "https://zz-site.com/hryvnia",
      title: "Курс гривны",
      text: "Украина: курс гривны к доллару на межбанке снова изменился за неделю торгов.",
      queries: [],
    });
    assert.equal(enrich(c, claimStems), null);
  });

  it("если ключевое слово одно — хватает одного совпадения", () => {
    const c = candidate({
      url: "https://zz-site.com/hryvnia",
      title: "Курс гривны",
      text: "Украина: курс гривны к доллару на межбанке снова изменился за неделю торгов.",
      queries: [],
    });
    assert.equal(enrich(c, ["украи"])?.match, 1);
  });

  it("текст дальше 200 000 символов не учитывается при проверке темы", () => {
    const c = candidate({
      url: "https://zz-site.com/long",
      title: "Длинная страница",
      text: "а ".repeat(100_001) + onTopic,
      queries: [],
    });
    assert.equal(enrich(c, claimStems), null);
  });

  it("base = 0.45·relevance (обрезан до 1) + 0.35·надёжность + 0.2·совпадение", () => {
    const e = enrich(candidate({ url: "https://zz-site.com/x", text: onTopic, relevance: 3 }), claimStems);
    assert.ok(e);
    assert.ok(Math.abs(e.base - (0.45 + 0.35 * e.info.reliability + 0.2 * e.match)) < 1e-9);
  });
});

interface ItemOptions {
  type?: SourceType;
  /** null — страна неизвестна */
  country?: string | null;
  language?: LanguageCode;
  publisher?: string;
  domain?: string;
  intent?: QueryIntent;
  match?: number;
}

function item(name: string, base: number, o: ItemOptions = {}): Enriched {
  const domain = o.domain ?? `${name}.com`;
  return {
    candidate: candidate({
      url: `https://${domain}/${name}`,
      title: name,
      queries: [{ text: name, intent: o.intent ?? "confirm" }],
    }),
    info: {
      publisher: o.publisher ?? name,
      type: o.type ?? "news",
      country: o.country === null ? undefined : (o.country ?? "GB"),
      reliability: 0.8,
    },
    domain,
    language: o.language ?? "en",
    excerpt: name,
    snippet: name,
    match: o.match ?? 1,
    base,
  };
}

const names = (items: Enriched[]) => items.map((e) => e.candidate.title);

describe("selectDiverse", () => {
  it("первым берёт источник с наибольшим весом, не больше max", () => {
    const pool = [item("a", 0.5), item("b", 0.9), item("c", 0.7)];
    assert.deepEqual(names(selectDiverse(pool, 1)), ["b"]);
    assert.equal(selectDiverse(pool, 2).length, 2);
  });

  it("пустой пул или max = 0 → пусто; пул меньше max → все", () => {
    assert.deepEqual(selectDiverse([], 5), []);
    assert.deepEqual(selectDiverse([item("a", 0.5)], 0), []);
    assert.equal(selectDiverse([item("a", 0.5), item("b", 0.4)], 5).length, 2);
  });

  it("не больше одного источника с одного домена", () => {
    const pool = [
      item("a1", 0.9, { domain: "a.com", publisher: "A1" }),
      item("a2", 0.8, { domain: "a.com", publisher: "A2" }),
    ];
    assert.deepEqual(names(selectDiverse(pool, 5)), ["a1"]);
  });

  it("не больше одного источника от издателя, даже с разных доменов (bbc.com и bbc.co.uk)", () => {
    const pool = [
      item("bbc-com", 0.9, { domain: "bbc.com", publisher: "BBC" }),
      item("bbc-uk", 0.85, { domain: "bbc.co.uk", publisher: "BBC" }),
      item("other", 0.3),
    ];
    assert.deepEqual(names(selectDiverse(pool, 5)), ["bbc-com", "other"]);
  });

  it("не больше одного источника с одного сайта: поддомены считаются одним сайтом", () => {
    const pool = [
      item("cnn-edition", 0.9, { domain: "edition.cnn.com", publisher: "CNN International" }),
      item("cnn-main", 0.85, { domain: "cnn.com", publisher: "CNN" }),
      item("bbc-news", 0.8, { domain: "news.bbc.co.uk", publisher: "BBC News" }),
      item("bbc-uk", 0.75, { domain: "bbc.co.uk", publisher: "BBC" }),
    ];
    assert.deepEqual(names(selectDiverse(pool, 5)), ["cnn-edition", "bbc-news"]);
  });

  it("бонус за новый тип источника перевешивает небольшую разницу в весе", () => {
    const pool = [item("news1", 0.8), item("news2", 0.7), item("org", 0.6, { type: "international_org" })];
    assert.deepEqual(names(selectDiverse(pool, 2)), ["news1", "org"]);
  });

  it("бонус за новую страну", () => {
    const pool = [item("gb1", 0.8), item("gb2", 0.75), item("de", 0.7, { country: "DE" })];
    assert.deepEqual(names(selectDiverse(pool, 2)), ["gb1", "de"]);
  });

  it("источник без страны не получает бонус за страну", () => {
    const pool = [item("gb1", 0.8), item("gb2", 0.75), item("none", 0.7, { country: null })];
    assert.deepEqual(names(selectDiverse(pool, 2)), ["gb1", "gb2"]);
  });

  it("бонус за новый язык", () => {
    const pool = [item("en1", 0.8), item("en2", 0.75), item("ru", 0.7, { language: "ru" })];
    assert.deepEqual(names(selectDiverse(pool, 2)), ["en1", "ru"]);
  });

  it("бонус за первый источник из запроса на опровержение — только один раз", () => {
    const pool = [
      item("confirm1", 0.8),
      item("confirm2", 0.75),
      item("refute1", 0.7, { intent: "refute" }),
      item("refute2", 0.69, { intent: "refute" }),
    ];
    assert.deepEqual(names(selectDiverse(pool, 3)), ["confirm1", "refute1", "confirm2"]);
  });

  it("бонус за опровержение не даётся странице, которая слабо совпадает с тезисом (match < 0.5)", () => {
    const pool = [
      item("confirm1", 0.8),
      item("confirm2", 0.75),
      item("refute-weak", 0.7, { intent: "refute", match: 0.3 }),
    ];
    assert.deepEqual(names(selectDiverse(pool, 2)), ["confirm1", "confirm2"]);
  });

  it("большой отрыв по весу важнее бонусов разнообразия", () => {
    const pool = [
      item("news1", 0.9),
      item("news2", 0.85),
      item("org", 0.3, { type: "academic", country: "US", language: "ru" }),
    ];
    assert.deepEqual(names(selectDiverse(pool, 2)), ["news1", "news2"]);
  });

  it("не мутирует входной массив", () => {
    const pool = [item("a", 0.5), item("b", 0.9)];
    selectDiverse(pool, 2);
    assert.deepEqual(names(pool), ["a", "b"]);
  });
});

describe("registrableDomain", () => {
  it("поддомены → сайт второго уровня", () => {
    assert.equal(registrableDomain("edition.cnn.com"), "cnn.com");
    assert.equal(registrableDomain("m.cnn.com"), "cnn.com");
    assert.equal(registrableDomain("cnn.com"), "cnn.com");
    assert.equal(registrableDomain("ru.wikipedia.org"), "wikipedia.org");
  });

  it("зоны второго уровня под ccTLD: co.uk, com.ua, or.jp, net.au, ac.uk, gov.uk", () => {
    assert.equal(registrableDomain("news.bbc.co.uk"), "bbc.co.uk");
    assert.equal(registrableDomain("bbc.co.uk"), "bbc.co.uk");
    assert.equal(registrableDomain("zz-kyiv-news.com.ua"), "zz-kyiv-news.com.ua");
    assert.equal(registrableDomain("www3.nhk.or.jp"), "nhk.or.jp");
    assert.equal(registrableDomain("abc.net.au"), "abc.net.au");
    assert.equal(registrableDomain("www.ox.ac.uk"), "ox.ac.uk");
    assert.equal(registrableDomain("ons.gov.uk"), "ons.gov.uk");
  });

  // БАГ: SECOND_LEVEL (select.ts:164) не знает национальные госзоны gouv.fr / gob.mx / gob.es / gc.ca,
  // которые domains.ts считает госорганами. Все министерства страны схлопываются в один «сайт»,
  // и selectDiverse берёт только один госисточник из этой страны.
  it("разные госорганы в gouv.fr / gob.mx / gob.es / gc.ca — разные сайты", () => {
    assert.equal(registrableDomain("www.economie.gouv.fr"), "economie.gouv.fr");
    assert.equal(registrableDomain("interieur.gouv.fr"), "interieur.gouv.fr");
    assert.equal(registrableDomain("www.inegi.gob.mx"), "inegi.gob.mx");
    assert.equal(registrableDomain("www.hacienda.gob.es"), "hacienda.gob.es");
    assert.equal(registrableDomain("www150.statcan.gc.ca"), "statcan.gc.ca");
  });
});

describe("toFoundSource", () => {
  it("переносит поля Enriched в FoundSource", () => {
    const e = item("reuters", 0.9, { domain: "reuters.com", publisher: "Reuters", country: "GB" });
    e.candidate.publishedAt = "Thu, 02 Oct 2026 08:00:00 GMT";
    assert.deepEqual(toFoundSource(e, "clm_1_s1", "2026-10-03T10:00:00.000Z"), {
      id: "clm_1_s1",
      url: "https://reuters.com/reuters",
      title: "reuters",
      publisher: "Reuters",
      domain: "reuters.com",
      sourceType: "news",
      publishedAt: "2026-10-02T08:00:00.000Z",
      language: "en",
      country: "GB",
      excerpt: "reuters",
      snippet: "reuters",
      domainReliability: 0.8,
      retrievedAt: "2026-10-03T10:00:00.000Z",
    });
  });

  it("пустой заголовок → издатель; нераспознанная дата → без publishedAt", () => {
    const e = item("x", 0.5, { publisher: "Издание" });
    e.candidate.title = "";
    e.candidate.publishedAt = "вчера";
    const s = toFoundSource(e, "id", "now");
    assert.equal(s.title, "Издание");
    assert.equal(s.publishedAt, undefined);
  });
});
