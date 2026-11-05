#!/usr/bin/env node
/**
 * Очистка демо: база кабинета и кэш готовых отчётов. Папка tmp/eval с прогонами не трогается.
 * Сервер держит базу и отчёты в памяти, поэтому сначала его надо остановить.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE = join(ROOT, "backend/tmp/cabinet-real.sqlite");
const REPORTS = join(tmpdir(), "factcheck-reports");
const dryRun = process.argv.includes("--dry-run");

const running = await new Promise((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port: 8787 });
  socket.once("connect", () => (socket.destroy(), resolve(true)));
  socket.once("error", () => resolve(false));
});
if (running && !dryRun) {
  console.error("Сервер на порту 8787 работает. Остановите демо и повторите.");
  process.exit(1);
}

const files = [DATABASE, `${DATABASE}-wal`, `${DATABASE}-shm`].filter(existsSync);
const reports = existsSync(REPORTS) ? readdirSync(REPORTS).filter((name) => name.endsWith(".json")) : [];
if (dryRun) {
  console.log(`Будет удалено: файлов базы ${files.length}, отчётов в кэше ${reports.length}`);
  process.exit(0);
}
for (const file of files) rmSync(file);
for (const name of reports) rmSync(join(REPORTS, name));
console.log(`Удалено: файлов базы ${files.length}, отчётов в кэше ${reports.length}`);
