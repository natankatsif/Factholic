import assert from "node:assert/strict";
import { test } from "node:test";
import { textsFor } from "../stages/09-report/texts.ts";
import { reportLabels, SLOTS } from "./report-labels.ts";

test("подпись с любого языка переводится на нужный", () => {
  const labels = reportLabels("ro");
  const en = textsFor("en");
  const ro = textsFor("ro");
  assert.equal(labels.exact[en.node.dateUnknown], ro.node.dateUnknown);
  assert.equal(labels.exact[textsFor("ru").node.dateUnknown], ro.node.dateUnknown);
});

test("шаблоны с датой сохраняют значение", () => {
  const labels = reportLabels("ro");
  const from = textsFor("en").flags.oldContentDetail(SLOTS[0]!);
  assert.ok(labels.patterns.some((pattern) => pattern.from === from && pattern.to.includes(SLOTS[0]!)));
});
