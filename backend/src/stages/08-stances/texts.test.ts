import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixedTexts, type FixedStances } from "./texts.ts";

const KINDS: FixedStances[] = ["no_sources", "few_sources", "prediction"];
const LANGUAGES = ["ru", "uk", "en"];

/** Слова вердикта и шкалы — в «сторонах» их быть не должно */
const VERDICT_WORDS: Record<string, RegExp> = {
  ru: /(?<!\p{L})(правд|ложь|ложн|оценк|балл)/iu,
  uk: /(?<!\p{L})(правд|неправд|хибн|оцінк|бал)/iu,
  en: /\b(true|false|score|rating|verdict)/i,
};

describe("fixedTexts", () => {
  it("есть непустые summary и explanation для каждого случая на ru / uk / en", () => {
    for (const lang of LANGUAGES) {
      for (const kind of KINDS) {
        const { summary, explanation } = fixedTexts(kind, lang);
        assert.ok(summary.trim().length > 10, `${lang}/${kind} summary`);
        assert.ok(explanation.trim().length > summary.trim().length / 2, `${lang}/${kind} explanation`);
      }
    }
  });

  it("тексты различаются по случаям и по языкам", () => {
    const all = LANGUAGES.flatMap((lang) => KINDS.map((kind) => fixedTexts(kind, lang).summary));
    assert.equal(new Set(all).size, all.length);
  });

  it("без вердикта: ни «правда/ложь», ни оценок", () => {
    for (const lang of LANGUAGES) {
      for (const kind of KINDS) {
        const { summary, explanation } = fixedTexts(kind, lang);
        assert.doesNotMatch(`${summary}\n${explanation}`, VERDICT_WORDS[lang], `${lang}/${kind}`);
      }
    }
  });

  it("язык текста соответствует языку UI", () => {
    assert.match(fixedTexts("prediction", "ru").summary, /прогноз/);
    assert.match(fixedTexts("prediction", "uk").summary, /прогноз/);
    assert.match(fixedTexts("prediction", "en").summary, /prediction/);
    assert.match(fixedTexts("no_sources", "uk").summary, /джерел/);
    assert.match(fixedTexts("few_sources", "ru").summary, /источник/);
    assert.match(fixedTexts("few_sources", "en").summary, /sources/);
  });

  it("язык UI, которого нет в словаре → английский", () => {
    for (const kind of KINDS) {
      assert.deepEqual(fixedTexts(kind, "de"), fixedTexts(kind, "en"));
      assert.deepEqual(fixedTexts(kind, ""), fixedTexts(kind, "en"));
    }
  });
});
