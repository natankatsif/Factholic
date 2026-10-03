import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claimNumbers,
  dateFromHtml,
  dateFromUrl,
  extractAttributions,
  extractLinks,
  isLivingDocument,
} from "./copies.ts";

describe("copies: даты", () => {
  it("datePublished из JSON-LD", () => {
    assert.equal(dateFromHtml('{"datePublished":"2023-03-14T10:00:00Z"}'), "2023-03-14T10:00:00.000Z");
  });

  it("опубликовано и изменено различаются больше чем на год — живой документ, даты нет", () => {
    // так выглядит Википедия: статья создана в 2011, правится до сих пор
    const html = '{"datePublished":"2011-03-10T00:00:00Z","dateModified":"2026-09-16T00:00:00Z"}';
    assert.equal(dateFromHtml(html), undefined);
  });

  it("правка в пределах года — дата публикации остаётся", () => {
    const html = '{"datePublished":"2026-01-10T00:00:00Z","dateModified":"2026-02-01T00:00:00Z"}';
    assert.equal(dateFromHtml(html), "2026-01-10T00:00:00.000Z");
  });

  it("только dateModified (point.md) — берём его как запасной вариант", () => {
    assert.equal(dateFromHtml('{"dateModified":"2026-10-03T14:42:00+03:00"}'), "2026-10-03T11:42:00.000Z");
  });

  it("Википедия и счётчики — живые документы", () => {
    assert.ok(isLivingDocument("https://ro.wikipedia.org/wiki/Populația_Pământului"));
    assert.ok(isLivingDocument("https://www.worldometers.info/world-population/"));
    assert.ok(isLivingDocument("https://ru.ruwiki.ru/wiki/Население_Земли"));
    assert.ok(!isLivingDocument("https://www.un.org/en/dayof8billion"));
  });

  it("дата из адреса", () => {
    assert.equal(dateFromUrl("https://x.md/2023/03/14/pozhar"), "2023-03-14T00:00:00.000Z");
    assert.equal(dateFromUrl("https://x.md/news/pozhar-v-tc"), undefined);
  });
});

describe("copies: ссылки и «по данным»", () => {
  it("внешние ссылки без своих, служебных, хештегов и медиафайлов", () => {
    const md = [
      "[NYT](https://www.nytimes.com/2026/10/03/us/politics/oil-deal.html)",
      "[своя](https://site.md/ru/other-news-123)",
      "[#тег](https://twitter.com/hashtag/population)",
      "[подкаст](https://cdn.example.com/a/b/episode.mp3?x=1)",
      "[профиль](https://max.ru/vedomosti)",
      "[счётчик](https://top.mail.ru/Rating/x/y)",
    ].join(" ");
    assert.deepEqual(extractLinks(md, "https://site.md/ru/news"), [
      "https://www.nytimes.com/2026/10/03/us/politics/oil-deal.html",
    ]);
  });

  it("«по данным …» на ru/ro/en, без «сообщил о …»", () => {
    const found = extractAttributions(
      "По данным мэрии, пострадали двое. Potrivit poliției, focul a fost stins. Он сообщил о пожаре. According to Reuters, it ended.",
    );
    assert.ok(found.some((a) => a.startsWith("По данным мэрии")));
    assert.ok(found.some((a) => a.startsWith("Potrivit poliției")));
    assert.ok(found.some((a) => a.startsWith("According to Reuters")));
    assert.ok(!found.some((a) => a.includes("сообщил о")));
  });
});

describe("copies: числа утверждения для раннего упоминания", () => {
  const claim = (normalized: string, numbers: string[] = []) =>
    ({ normalized, structure: { numbers: numbers.map((value) => ({ value, about: "" })) } }) as never;

  it("числа из структуры, без годов, запятая → точка", () => {
    assert.deepEqual(claimNumbers(claim("…", ["8 миллиардов", "3,5 млн"])), ["8", "3.5"]);
  });
  it("без структуры — из текста, годы не считаются числами", () => {
    assert.deepEqual(claimNumbers(claim("Население Земли превысило 8 млрд в 2022 году")), ["8"]);
  });
  it("нет чисел — правило не применяется", () => {
    assert.deepEqual(claimNumbers(claim("В Украине идёт война")), []);
  });
});
