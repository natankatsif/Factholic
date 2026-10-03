#!/usr/bin/env node
/**
 * Проверка типов по юнитам (см. scripts/units.mjs). Юниты проверяются параллельно и независимо.
 *
 *   node scripts/check.mjs                 все юниты (tsc + eslint)
 *   node scripts/check.mjs 03 extension    только юниты, чей id содержит "03" или "extension"
 *   node scripts/check.mjs --staged        юниты, затронутые застейдженными файлами (pre-commit)
 */
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { UNITS, unitsForFiles } from "./units.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TSC = join(ROOT, "node_modules/typescript/bin/tsc");
const ESLINT = join(ROOT, "node_modules/eslint/bin/eslint.js");

const args = process.argv.slice(2);
const staged = args.includes("--staged");
const filters = args.filter((a) => !a.startsWith("--"));

let units;
if (staged) {
  const files = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMRD"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  units = unitsForFiles(files);
} else if (filters.length) {
  units = UNITS.filter((u) => filters.some((f) => u.id.includes(f)));
  if (!units.length)
    fail(`Нет юнитов по фильтру: ${filters.join(", ")}. Есть: ${UNITS.map((u) => u.id).join(", ")}`);
} else {
  units = UNITS;
}

if (!units.length) {
  console.log("check: изменения не затрагивают ни один юнит — пропускаю");
  process.exit(0);
}

console.log(`check: ${units.map((u) => u.id).join(", ")}\n`);

const results = await Promise.all(
  units.map(async (unit) => {
    const outputs = [await run(TSC, ["-p", unit.tsconfig, "--pretty"])];
    // в --staged режиме eslint уже прогнал lint-staged по самим застейдженным файлам
    if (!staged) outputs.push(await run(ESLINT, ["--max-warnings=0", ...lintTargets(unit)]));
    const failed = outputs.filter((o) => o.code !== 0);
    return { unit, ok: failed.length === 0, output: failed.map((o) => o.text).join("\n") };
  }),
);

for (const { unit, ok, output } of results) {
  console.log(`${ok ? "✅" : "❌"} ${unit.id.padEnd(30)} владелец: ${unit.owner}`);
  if (!ok) console.log(indent(output.trim()) + "\n");
}

const broken = results.filter((r) => !r.ok);
if (broken.length) {
  fail(
    `\nСломано юнитов: ${broken.length}. Коммит заблокирован.\n` +
      `Перепроверить: npm run check -- ${broken.map((r) => r.unit.id).join(" ")}`,
  );
}

function lintTargets(unit) {
  return unit.paths.filter((p) => p.endsWith("/") || /\.(ts|mjs|js)$/.test(p));
}

function run(bin, binArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...binArgs], {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
    let text = "";
    child.stdout.on("data", (d) => (text += d));
    child.stderr.on("data", (d) => (text += d));
    child.on("close", (code) => resolve({ code, text }));
  });
}

function indent(s) {
  return s
    .split("\n")
    .map((l) => "   " + l)
    .join("\n");
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
