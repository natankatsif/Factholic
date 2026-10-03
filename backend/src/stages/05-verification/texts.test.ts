import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixedTexts, type FixedVerdict } from "./texts.ts";

const KINDS: FixedVerdict[] = ["no_sources", "no_evidence", "prediction"];

describe("fixedTexts", () => {
  it("есть непустые summary и explanation для каждого вердикта на ru / uk / en", () => {
    for (const lang of ["ru", "uk", "en"]) {
      for (const kind of KINDS) {
        const { summary, explanation } = fixedTexts(kind, lang);
        assert.ok(summary.trim().length > 10, `${lang}/${kind} summary`);
        assert.ok(explanation.trim().length > summary.trim().length / 2, `${lang}/${kind} explanation`);
      }
    }
  });

  it("тексты различаются по вердиктам и по языкам", () => {
    const all = ["ru", "uk", "en"].flatMap((lang) => KINDS.map((kind) => fixedTexts(kind, lang).summary));
    assert.equal(new Set(all).size, all.length);
  });

  it("язык текста соответствует языку UI", () => {
    assert.match(fixedTexts("prediction", "ru").summary, /прогноз/);
    assert.match(fixedTexts("prediction", "uk").summary, /прогноз/);
    assert.match(fixedTexts("prediction", "en").summary, /prediction/);
    assert.match(fixedTexts("no_sources", "uk").summary, /джерел/);
  });

  it("язык UI, которого нет в словаре → английский", () => {
    for (const kind of KINDS) {
      assert.deepEqual(fixedTexts(kind, "de"), fixedTexts(kind, "en"));
      assert.deepEqual(fixedTexts(kind, ""), fixedTexts(kind, "en"));
    }
  });
});
