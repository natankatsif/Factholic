/**
 * РЕЕСТР ЮНИТОВ — единственный источник правды о том, кто за что отвечает и что проверяется.
 *
 * Юнит = независимый кусок кода со своим владельцем и своим tsconfig.
 * Pre-commit проверяет ТОЛЬКО юниты, которых касаются застейдженные файлы,
 * поэтому сломанный (незакоммиченный) код в чужом юните не блокирует твой коммит.
 *
 * Исключение — изменения КОНТРАКТОВ (то, что импортируют другие):
 *   packages/contracts/**                 → проверяются все потребители (backend-core, extension)
 *   backend/src/stages/<этап>/types.ts     → проверяется весь бэкенд (backend-core)
 *   backend/src/stages/<этап>/mock.ts      → то же: моки следующих этапов строятся из моков предыдущих
 *   корневые конфиги (tsconfig.base.json…) → все юниты
 */

export const UNITS = [
  {
    id: "contracts",
    owner: "все трое, только по договорённости",
    paths: ["packages/contracts/"],
    tsconfig: "packages/contracts/tsconfig.json",
  },
  stage("01-ingest", "backend-1"),
  stage("02-transcription", "backend-1"),
  stage("03-claim-extraction", "backend-2"),
  stage("04-source-search", "backend-2"),
  stage("05-verification", "backend-2"),
  stage("06-delivery", "backend-1"),
  stage("05-provenance", "backend-2"),
  stage("06-mutations", "backend-2"),
  stage("07-root-date", "backend-2"),
  stage("08-stances", "backend-2"),
  stage("09-report", "backend-2"),
  {
    id: "backend-core",
    owner: "backend-1",
    paths: [
      "backend/src/pipeline/",
      "backend/src/server.ts",
      // config.ts импортируют все этапы → его изменение проверяет весь бэкенд
      "backend/src/config.ts",
      "backend/package.json",
      "backend/tsconfig.json",
    ],
    // весь бэкенд целиком: оркестратор импортирует все этапы
    tsconfig: "backend/tsconfig.json",
  },
  {
    id: "extension",
    owner: "frontend",
    paths: ["extension/"],
    tsconfig: "extension/tsconfig.json",
  },
  {
    id: "web",
    owner: "frontend",
    paths: ["web/"],
    tsconfig: "web/tsconfig.json",
  },
];

function stage(name, owner) {
  return {
    id: `backend-${name}`,
    owner,
    paths: [`backend/src/stages/${name}/`],
    tsconfig: `backend/src/stages/${name}/tsconfig.json`,
  };
}

const ROOT_CONFIGS = ["package.json", "package-lock.json", "tsconfig.base.json"];
const STAGE_CONTRACT = /^backend\/src\/stages\/[^/]+\/(types|mock)\.ts$/;

/** Какие юниты проверить для данного набора изменённых файлов (пути относительно корня репо). */
export function unitsForFiles(files) {
  const ids = new Set();
  for (const file of files) {
    if (ROOT_CONFIGS.includes(file)) return UNITS;

    const own = UNITS.find((u) => u.paths.some((p) => (p.endsWith("/") ? file.startsWith(p) : file === p)));
    if (own) ids.add(own.id);

    if (file.startsWith("packages/contracts/")) {
      ids.add("backend-core");
      ids.add("extension");
      ids.add("web");
    }
    if (STAGE_CONTRACT.test(file)) ids.add("backend-core");
  }
  return UNITS.filter((u) => ids.has(u.id));
}
