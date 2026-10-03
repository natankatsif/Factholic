/**
 * Сборка расширения в dist/. Берёт EXT_* из корневого .env (переменные окружения имеют приоритет).
 *   node build.mjs           один раз
 *   node build.mjs --watch   пересборка при изменениях
 */
import { context } from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const ENV_FILE = here("../.env");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const dataSource = process.env.EXT_DATA_SOURCE || "mock";
const backendUrl = process.env.EXT_BACKEND_URL || "http://localhost:8787";
if (!["mock", "backend"].includes(dataSource)) {
  console.error(`EXT_DATA_SOURCE="${dataSource}" — допустимо: mock | backend`);
  process.exit(1);
}

const define = {
  __EXT_DATA_SOURCE__: JSON.stringify(dataSource),
  __EXT_BACKEND_URL__: JSON.stringify(backendUrl),
};

const entries = [
  {
    entryPoints: [here("src/background/service-worker.ts")],
    outfile: here("dist/background.js"),
    format: "esm",
  },
  { entryPoints: [here("src/content/index.ts")], outfile: here("dist/content.js"), format: "iife" },
];

mkdirSync(here("dist"), { recursive: true });

// host_permissions — под фактический адрес бэкенда
const manifest = JSON.parse(readFileSync(here("manifest.json"), "utf8"));
manifest.host_permissions = [`${new URL(backendUrl).origin}/*`];
writeFileSync(here("dist/manifest.json"), JSON.stringify(manifest, null, 2));

const watch = process.argv.includes("--watch");
const contexts = await Promise.all(
  entries.map((e) => context({ ...e, bundle: true, define, logLevel: "info" })),
);
if (watch) {
  await Promise.all(contexts.map((c) => c.watch()));
} else {
  await Promise.all(contexts.map((c) => c.rebuild()));
  await Promise.all(contexts.map((c) => c.dispose()));
}
console.log(`extension: EXT_DATA_SOURCE=${dataSource}  EXT_BACKEND_URL=${backendUrl}`);
