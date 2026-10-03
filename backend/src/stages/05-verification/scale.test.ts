import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitScore, LABELS, SCORE_RANGE } from "./scale.ts";

describe("fitScore", () => {
  it("unverifiable → всегда null, даже если модель поставила оценку", () => {
    assert.equal(fitScore("unverifiable", 7), null);
    assert.equal(fitScore("unverifiable", null), null);
  });

  it("оценка вне диапазона метки прижимается к границе", () => {
    assert.equal(fitScore("true", 12), 10);
    assert.equal(fitScore("true", 3), 9);
    assert.equal(fitScore("misleading", 8), 5);
    assert.equal(fitScore("mostly_false", 0), 2);
    assert.equal(fitScore("false", -3), 0);
    assert.equal(fitScore("false", 6), 1);
  });

  it("дробная оценка округляется до целого", () => {
    assert.equal(fitScore("mixed", 5.4), 5);
    assert.equal(fitScore("mixed", 5.6), 6);
    assert.equal(fitScore("mostly_true", 7.5), 8);
  });

  it("оценка внутри диапазона не меняется", () => {
    assert.equal(fitScore("mostly_true", 7), 7);
    assert.equal(fitScore("misleading", 3), 3);
  });

  it("нет оценки или она не число → середина диапазона метки", () => {
    assert.equal(fitScore("misleading", null), 4);
    assert.equal(fitScore("mostly_false", Number.NaN), 3);
    assert.equal(fitScore("true", Number.POSITIVE_INFINITY), 10);
  });

  it("для любой метки и любого входа результат — целое в диапазоне метки", () => {
    const inputs = [null, -100, -0.4, 0, 0.5, 1, 2.5, 4.49, 5, 6.5, 8.2, 9.9, 10, 11, 1e9, Number.NaN];
    for (const label of LABELS) {
      if (label === "unverifiable") continue;
      const [min, max] = SCORE_RANGE[label];
      for (const score of inputs) {
        const fitted = fitScore(label, score);
        assert.ok(
          fitted !== null && Number.isInteger(fitted) && fitted >= min && fitted <= max,
          `${label} ${score} → ${fitted}`,
        );
      }
    }
  });

  it("шкала покрывает 0–10 без дыр и соответствует README", () => {
    assert.deepEqual(SCORE_RANGE, {
      true: [9, 10],
      mostly_true: [7, 8],
      mixed: [5, 6],
      misleading: [3, 5],
      mostly_false: [2, 4],
      false: [0, 1],
    });
    for (let s = 0; s <= 10; s++) {
      const inside = Object.values(SCORE_RANGE).some(([min, max]) => s >= min && s <= max);
      assert.ok(inside, `оценка ${s} не принадлежит ни одной метке`);
    }
  });
});
