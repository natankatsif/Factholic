import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lookupDomain, normalizeHost } from "./domains.ts";

// Справочник параллельно дополняется — тесты завязаны только на поведение и известные записи
// (reuters.com, wikipedia.org, factcheck.afp.com). Для эвристик — заведомо выдуманные домены «zz-…».

describe("normalizeHost", () => {
  it("нижний регистр и без www.", () => {
    assert.equal(normalizeHost("WWW.Reuters.COM"), "reuters.com");
    assert.equal(normalizeHost("news.bbc.co.uk"), "news.bbc.co.uk");
    assert.equal(normalizeHost("www2.example.com"), "www2.example.com");
  });
});

describe("lookupDomain: справочник", () => {
  it("известный домен: издатель, тип, страна, надёжность выше умолчания", () => {
    const info = lookupDomain("reuters.com", "other");
    assert.equal(info.publisher, "Reuters");
    assert.equal(info.type, "news");
    assert.equal(info.country, "GB");
    assert.ok(info.reliability > 0.5 && info.reliability <= 1);
  });

  it("www. и регистр не мешают", () => {
    assert.deepEqual(lookupDomain("WWW.REUTERS.COM", "other"), lookupDomain("reuters.com", "other"));
  });

  it("поддомен наследует запись родительского домена", () => {
    const wiki = lookupDomain("wikipedia.org", "other");
    assert.equal(wiki.type, "encyclopedia");
    assert.deepEqual(lookupDomain("ru.wikipedia.org", "news"), wiki);
    assert.deepEqual(lookupDomain("en.m.wikipedia.org", "news"), wiki);
  });

  it("более точная запись важнее родительской: factcheck.afp.com — фактчекер", () => {
    const info = lookupDomain("factcheck.afp.com", "news");
    assert.equal(info.type, "fact_checker");
    assert.deepEqual(lookupDomain("www.factcheck.afp.com", "news"), info);
    assert.deepEqual(lookupDomain("ru.factcheck.afp.com", "news"), info);
  });

  it("чужой домен с известным именем внутри не выдаётся за издателя", () => {
    for (const host of ["reuters.com.zz-mirror.net", "notreuters.com", "reuters.com-zz.info"]) {
      const info = lookupDomain(host, "news");
      assert.notEqual(info.publisher, "Reuters", host);
      assert.equal(info.reliability, 0.5, host);
    }
  });
});

describe("lookupDomain: эвристики по доменной зоне", () => {
  it(".gov без страны в зоне → госорган США", () => {
    const info = lookupDomain("zz-agency.gov", "news");
    assert.equal(info.type, "government");
    assert.equal(info.country, "US");
    assert.ok(info.reliability > 0.5);
    assert.equal(info.publisher, "zz-agency.gov");
  });

  it(".mil → госорган", () => {
    assert.equal(lookupDomain("zz-base.mil", "news").type, "government");
  });

  it("gov.uk и его поддомены → госорган Великобритании", () => {
    for (const host of ["zz-office.gov.uk", "www.zz.gov.uk"]) {
      const info = lookupDomain(host, "news");
      assert.equal(info.type, "government", host);
      assert.equal(info.country, "GB", host);
    }
  });

  it("национальные госзоны: gouv.fr, gob.mx, gc.ca, gov.ua", () => {
    assert.deepEqual(
      ["zz.gouv.fr", "zz.gob.mx", "zz-stat.gc.ca", "zz.gov.ua"].map((h) => {
        const { type, country } = lookupDomain(h, "news");
        return [type, country];
      }),
      [
        ["government", "FR"],
        ["government", "MX"],
        ["government", "CA"],
        ["government", "UA"],
      ],
    );
  });

  it(".int → международная организация без страны", () => {
    const info = lookupDomain("zz-org.int", "news");
    assert.equal(info.type, "international_org");
    assert.equal(info.country, undefined);
    assert.ok(info.reliability > 0.5);
  });

  it(".edu, .ac.uk, .edu.au → академический источник", () => {
    const edu = lookupDomain("zz-uni.edu", "news");
    assert.equal(edu.type, "academic");
    assert.equal(edu.country, undefined);
    assert.ok(edu.reliability > 0.5);

    const ac = lookupDomain("zz-college.ac.uk", "news");
    assert.equal(ac.type, "academic");
    assert.equal(ac.country, "GB");

    assert.equal(lookupDomain("zz.edu.au", "news").country, "AU");
  });

  it("неизвестный домен в ccTLD → тип по умолчанию, страна по зоне, надёжность 0.5", () => {
    assert.deepEqual(lookupDomain("zz-news.de", "news"), {
      publisher: "zz-news.de",
      type: "news",
      country: "DE",
      reliability: 0.5,
    });
    assert.equal(lookupDomain("zz-news.com.ua", "news").country, "UA");
  });

  it("неизвестный домен в общей зоне → без страны, тип из fallbackType", () => {
    assert.deepEqual(lookupDomain("zz-site.com", "other"), {
      publisher: "zz-site.com",
      type: "other",
      country: undefined,
      reliability: 0.5,
    });
    assert.equal(lookupDomain("zz-site.org", "fact_checker").type, "fact_checker");
  });
});
