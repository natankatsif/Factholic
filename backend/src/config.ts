/**
 * ЕДИНСТВЕННОЕ место в бэкенде, где читается process.env (eslint запрещает это в других файлах).
 * Значения — из корневого .env (шаблон: .env.example). Переменные окружения имеют приоритет над .env.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Stage } from "./pipeline/context.ts";

const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const env = process.env;

export type ImplMode = "mock" | "real";
export type ServerMode = "pipeline" | "replay";
export type SwitchableStage =
  | "ingest"
  | "transcription"
  | "claimExtraction"
  | "sourceSearch"
  | "verification"
  // новая концепция (дерево первоисточника), backend-2
  | "provenance"
  | "mutations"
  | "stances";

/** Какая переменная переключает этап и какие переменные нужны ему в режиме real */
const STAGES: Record<SwitchableStage, { envVar: string; requires: string[] }> = {
  ingest: { envVar: "STAGE_INGEST", requires: [] },
  transcription: { envVar: "STAGE_TRANSCRIPTION", requires: ["ASR_PROVIDER", "ASR_API_KEY"] },
  claimExtraction: {
    envVar: "STAGE_CLAIM_EXTRACTION",
    requires: ["LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"],
  },
  sourceSearch: {
    envVar: "STAGE_SOURCE_SEARCH",
    requires: ["SEARCH_PROVIDER", "SEARCH_API_KEY", "LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"],
  },
  verification: { envVar: "STAGE_VERIFICATION", requires: ["LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"] },
  provenance: { envVar: "STAGE_PROVENANCE", requires: ["LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"] },
  mutations: { envVar: "STAGE_MUTATIONS", requires: ["LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"] },
  stances: { envVar: "STAGE_STANCES", requires: ["LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"] },
};

const stagesDefault = oneOf<ImplMode>("STAGES_DEFAULT", ["mock", "real"], "mock");

export const config = {
  port: Number(env.PORT ?? 8787),
  serverMode: oneOf<ServerMode>("SERVER_MODE", ["pipeline", "replay"], "pipeline"),
  stages: Object.fromEntries(
    Object.entries(STAGES).map(([name, { envVar }]) => [
      name,
      oneOf<ImplMode>(envVar, ["mock", "real"], stagesDefault),
    ]),
  ) as Record<SwitchableStage, ImplMode>,
  /**
   * Сколько утверждений проверять (поиск + LLM — самая дорогая часть: ~9 запросов Tavily на утверждение).
   * Берутся самые важные по checkworthiness. Остальные не показываются.
   */
  limits: {
    maxClaimsPerChunk: positiveInt("MAX_CLAIMS_PER_CHUNK", 5),
    maxClaimsPerJob: positiveInt("MAX_CLAIMS_PER_JOB", 20),
  },
  /** Настройки провайдеров для real-реализаций. Пустая строка = не задано. */
  providers: {
    asr: { provider: env.ASR_PROVIDER ?? "", apiKey: env.ASR_API_KEY ?? "" },
    llm: {
      provider: env.LLM_PROVIDER ?? "",
      apiKey: env.LLM_API_KEY ?? "",
      model: env.LLM_MODEL ?? "",
      /** Эмбеддинги для поиска дублей текста в дереве (этап 05) */
      embeddingModel: env.LLM_EMBEDDING_MODEL || "text-embedding-3-small",
    },
    search: { provider: env.SEARCH_PROVIDER ?? "", apiKey: env.SEARCH_API_KEY ?? "" },
    /** Google Fact Check Tools — необязательный второй поисковик этапа 04 (разборы фактчекеров) */
    factCheck: { apiKey: env.GOOGLE_FACTCHECK_API_KEY ?? "" },
  },
} as const;

/** Выбор реализации этапа по конфигу. Вызывается в index.ts каждого этапа. */
export function selectImpl<I, O>(
  stage: SwitchableStage,
  impls: { mock: Stage<I, O>; real: Stage<I, O> },
): Stage<I, O> {
  return impls[config.stages[stage]];
}

/** Ошибки конфигурации: этап включён в real, а ключей нет. Сервер не стартует, пока список не пуст. */
export function configErrors(): string[] {
  if (config.serverMode === "replay") return [];
  return Object.entries(STAGES).flatMap(([name, { envVar, requires }]) => {
    if (config.stages[name as SwitchableStage] !== "real") return [];
    const missing = requires.filter((v) => !env[v]);
    return missing.length ? [`${envVar}=real, но не заданы: ${missing.join(", ")}`] : [];
  });
}

export function describeConfig(): string {
  if (config.serverMode === "replay")
    return `SERVER_MODE=replay (проигрываются MOCK_EVENTS, этапы не вызываются)`;
  const stages = Object.entries(config.stages)
    .map(([name, mode]) => `${name}=${mode === "real" ? "REAL" : "mock"}`)
    .join("  ");
  return `SERVER_MODE=pipeline  ${stages}`;
}

function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = env[name];
  if (value === undefined || value === "") return fallback;
  if (!allowed.includes(value as T)) {
    throw new Error(`${name}="${value}" — допустимо: ${allowed.join(" | ")}`);
  }
  return value as T;
}

function positiveInt(name: string, fallback: number): number {
  const value = env[name];
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name}="${value}" — нужно целое число ≥ 1`);
  return n;
}
