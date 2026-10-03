import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { Enriched } from "./select.ts";
import { assessSufficiency, mentionsNumber } from "./sufficiency.ts";
import { keywordStems } from "./text.ts";

const page = (domain: string, excerpt = "текст по теме", type = "news", match = 0.8): Enriched =>
  ({
    candidate: { title: `Новость ${domain}`, url: `https://${domain}/a` },
    info: { type },
    domain,
    excerpt,
    match,
  }) as never;

const claim = (over: Partial<Claim> = {}): Claim => ({ ...mockClaim, ...over });

describe("assessSufficiency", () => {
  it("три независимых сайта по теме — достаточно", () => {
    const r = assessSufficiency(claim(), [page("a.md"), page("b.md"), page("c.ro")]);
    assert.deepEqual(r, { sufficient: true, unconfirmed: [], gaps: [] });
  });

  it("поддомены одного сайта — один голос; один сайт — жёсткий пробел", () => {
    const r = assessSufficiency(claim(), [page("news.a.md"), page("www.a.md")]);
    assert.deepEqual(r.unconfirmed, ["найден только один независимый источник"]);
    assert.equal(r.sufficient, false);
  });

  it("два сайта — мягкий пробел, повод искать дальше, но не «недостаточно»", () => {
    const r = assessSufficiency(claim(), [page("a.md"), page("b.md")]);
    assert.deepEqual(r.unconfirmed, []);
    assert.deepEqual(r.gaps, ["независимых источников только 2"]);
  });

  it("страницы, где тема лишь мелькает (match < 0.4), не считаются", () => {
    const r = assessSufficiency(claim(), [
      page("a.md"),
      page("b.md", "", "news", 0.3),
      page("c.md", "", "news", 0.2),
    ]);
    assert.deepEqual(r.unconfirmed, ["найден только один независимый источник"]);
  });

  it("статистике нужен официальный источник", () => {
    const stat = claim({ category: "statistic", normalized: "Безработица выросла" });
    assert.deepEqual(assessSufficiency(stat, [page("a.md"), page("b.md"), page("c.md")]).gaps, [
      "нет официального, научного или фактчекингового источника",
    ]);
    assert.equal(
      assessSufficiency(stat, [page("a.md"), page("b.md"), page("statistica.md", "", "government")])
        .sufficient,
      true,
    );
  });

  it("число из утверждения никто не называет — жёсткий пробел; «2,5» и «2.5» — одно число", () => {
    const c = claim({
      normalized: "Пострадали 200 человек",
      structure: { ...mockClaim.structure!, numbers: [{ value: "200", about: "пострадавших" }] },
    });
    const without = assessSufficiency(c, [page("a.md", "пострадали люди"), page("b.md"), page("c.md")]);
    assert.deepEqual(without.unconfirmed, ["ни один источник не называет число 200 (пострадавших)"]);
    const withIt = assessSufficiency(c, [page("a.md", "пострадали 200 человек"), page("b.md"), page("c.md")]);
    assert.deepEqual(withIt.unconfirmed, []);

    const decimal = claim({ normalized: "Население 2,5 миллиона", structure: undefined });
    assert.deepEqual(
      assessSufficiency(decimal, [page("a.md", "около 2.5 млн"), page("b.md"), page("c.md")]).unconfirmed,
      [],
    );
  });
});

describe("mentionsNumber: число рядом с тем, что оно считает", () => {
  const about = keywordStems("пострадавших");
  it("«200 пострадавших» — да; «200 метров от рынка» — нет", () => {
    assert.ok(mentionsNumber("при пожаре пострадали 200 человек", "200", about));
    assert.ok(
      !mentionsNumber(
        "пожар в 200 метрах от рынка, никто не пострадал".replace("никто не пострадал", ""),
        "200",
        about,
      ),
    );
  });
  it("без about — достаточно самого числа", () => {
    assert.ok(mentionsNumber("около 200 метров", "200", []));
  });
});

describe("mentionsNumber: одно число в разной записи", () => {
  it("«4» в утверждении — «4,0%» и «4.0» в источнике; «4.0» в утверждении — «4» в источнике", () => {
    assert.ok(mentionsNumber("безработица 4.0%", "4", []));
    assert.ok(mentionsNumber("безработица 4%", "4.0", []));
    assert.ok(mentionsNumber("безработица 2.50 млн", "2.5", []));
  });
  it("«4» не совпадает с «4.5», «14» и «40»", () => {
    assert.ok(!mentionsNumber("4.5%", "4", []));
    assert.ok(!mentionsNumber("14%", "4", []));
    assert.ok(!mentionsNumber("40%", "4", []));
  });
});
