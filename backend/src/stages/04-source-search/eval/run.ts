/**
 * Eval этапа 04: прогоняет тезисы из eval/cases.ts через настоящую реализацию (real.ts) и проверяет выдачу
 * по метрикам разнообразия и полноты (не по конкретным URL — выдача поиска меняется).
 *
 * ВНИМАНИЕ: прогон ПЛАТНЫЙ — на каждый кейс 1 запрос к LLM (составление запросов; OpenAI, LLM_* в корневом
 * .env) и 3–5 запросов к Tavily с search_depth advanced (SEARCH_PROVIDER=tavily, SEARCH_API_KEY), плюс Google
 * Fact Check Tools, если задан GOOGLE_FACTCHECK_API_KEY. STAGE_SOURCE_SEARCH не важен: eval всегда вызывает real.
 *
 *   npm run eval:04 -w backend                              все кейсы
 *   npm run eval:04 -w backend -- --only measles            кейсы, чей id содержит подстроку (можно через запятую)
 *   npm run eval:04 -w backend -- --verbose                 + запросы, источники и лог этапа по каждому кейсу
 *
 * Без настроек поиска и LLM запросов нет: скрипт только проверяет, что кейсы корректны, и выходит с кодом 0.
 * С настройками — код 1, если провален хотя бы один кейс.
 */
import { inspect } from "node:util";
import { config } from "../../../config.ts";
import type { StageContext } from "../../../pipeline/context.ts";
import { searchSourcesReal } from "../real.ts";
import type { SourceSearchOutput } from "../types.ts";
import { CASES, type SourceSearchCase } from "./cases.ts";

/** Каждый кейс — до 5 поисковых запросов; общий лимит поиска в engines.ts — 6 одновременно */
const CONCURRENCY = 2;
const TIMEOUT_MS = 180_000;
const DEFAULT_MIN_SOURCES = 3;
/** README этапа: excerpt — до 2000 символов */
const EXCERPT_MAX_CHARS = 2000;

/**
 * В выходе этапа у SearchQuery нет intent (он есть только у PlannedQuery внутри queries.ts), поэтому
 * запрос на опровержение распознаётся по словам: fact check / миф / опровержение / спростування и т.п.
 */
const REFUTE_QUERY =
  /fact[\s-]?check|debunk|myth|hoax|fake|misinformation|true or|is it true|миф|опроверж|разоблач|фейк|правда ли|дезинформ|спростув|міф|неправд|чи правда|дезінформ|фактчек|перевірк/iu;

interface CaseResult {
  id: string;
  ms: number;
  /** Пусто — кейс прошёл */
  reasons: string[];
  details: string[];
  logs: string[];
}

process.exitCode = await main();

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return 1;

  const problems = validateCases(CASES);
  if (problems.length) {
    console.error(`Кейсы некорректны (${problems.length}):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    return 1;
  }
  const cases = pick(CASES, args.only);
  if (!cases) return 1;

  const missing = missingConfig();
  if (missing.length) {
    console.log(`Кейсы этапа 04 корректны: ${CASES.length} (выбрано ${cases.length}).`);
    console.log(
      `Нужен ключ поиска и LLM — не заданы ${missing.join(", ")} (корневой .env). Реальный прогон пропущен.`,
    );
    return 0;
  }

  console.log(
    `Eval 04 · поиск tavily${config.providers.factCheck.apiKey ? " + Google Fact Check" : ""} · ` +
      `LLM ${config.providers.llm.model} · кейсов ${cases.length} · параллельно ${CONCURRENCY}. Прогон платный.\n`,
  );
  let done = 0;
  const results = await mapPool(cases, CONCURRENCY, async (c) => {
    const r = await runCase(c);
    done++;
    console.log(`[${done}/${cases.length}] ${r.reasons.length ? "FAIL" : "PASS"} ${r.id}`);
    return r;
  });
  return printReport(results, args.verbose) ? 0 : 1;
}

// ---------- прогон и проверки ----------

async function runCase(c: SourceSearchCase): Promise<CaseResult> {
  const logs: string[] = [];
  const ctx: StageContext = {
    jobId: "eval",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    log: (msg, data) =>
      logs.push(data === undefined ? msg : `${msg} ${inspect(data, { depth: 2, breakLength: Infinity })}`),
  };
  const started = performance.now();
  try {
    const out = await searchSourcesReal(c.input, ctx);
    const reasons = checkOutput(c, out);
    // queries.ts при сбое LLM молча берёт простые запросы — тогда мы меряем не промпт, а запасной вариант
    if (logs.some((l) => l.includes("беру простые"))) {
      reasons.unshift("LLM не составила запросы, взяты простые (см. лог)");
    }
    return { id: c.id, ms: performance.now() - started, reasons, details: describe(out), logs };
  } catch (err) {
    const reason = ctx.signal.aborted ? `таймаут ${TIMEOUT_MS / 1000} с` : errorText(err);
    return {
      id: c.id,
      ms: performance.now() - started,
      reasons: [`исключение: ${reason}`],
      details: [],
      logs,
    };
  }
}

function checkOutput(c: SourceSearchCase, out: SourceSearchOutput): string[] {
  const reasons: string[] = [];
  const { claim, maxSources, searchLanguages } = c.input;
  const { sources, queries } = out;
  if (out.claimId !== claim.id) reasons.push(`claimId ${out.claimId} ≠ ${claim.id}`);

  // --- запросы ---
  if (!queries.some((q) => REFUTE_QUERY.test(q.text))) {
    reasons.push("нет запроса на опровержение (fact check / миф / опровержение …)");
  }
  const notSearched = searchLanguages.filter((l) => !queries.some((q) => q.language === l));
  if (notSearched.length) reasons.push(`нет запросов на языках: ${notSearched.join(", ")}`);

  // --- количество и контракт ---
  const min = c.expect?.minSources ?? DEFAULT_MIN_SOURCES;
  if (sources.length < min || sources.length > maxSources) {
    reasons.push(`источников ${sources.length}, ожидалось ${min}–${maxSources}`);
  }
  if (!sources.length) return reasons;

  const ids = new Set<string>();
  for (const s of sources) {
    const tag = `${s.id} (${s.domain})`;
    if (ids.has(s.id)) reasons.push(`${tag}: id повторяется`);
    ids.add(s.id);
    if (!s.excerpt.trim()) reasons.push(`${tag}: пустой excerpt`);
    if (!s.snippet.trim()) reasons.push(`${tag}: пустой snippet`);
    if (s.excerpt.length > EXCERPT_MAX_CHARS)
      reasons.push(`${tag}: excerpt ${s.excerpt.length} > ${EXCERPT_MAX_CHARS}`);
    if (!s.title.trim() || !s.publisher.trim()) reasons.push(`${tag}: пустые title / publisher`);
    if (!(s.domainReliability >= 0 && s.domainReliability <= 1))
      reasons.push(`${tag}: domainReliability вне 0..1`);
    try {
      const host = new URL(s.url).hostname.toLowerCase().replace(/^www\./, "");
      if (host !== s.domain) reasons.push(`${tag}: domain не совпадает с url (${host})`);
    } catch {
      reasons.push(`${tag}: неверный url ${s.url}`);
    }
  }

  // --- разнообразие точек зрения (принцип продукта №2) ---
  const types = new Set(sources.map((s) => s.sourceType));
  if (types.size < 2) reasons.push(`один тип источников (${[...types].join(", ")}), нужно ≥ 2`);

  const languages = new Set(sources.map((s) => s.language));
  const countries = new Set(sources.flatMap((s) => (s.country ? [s.country] : [])));
  if (languages.size < 2 && countries.size < 2) {
    reasons.push(
      `один язык (${[...languages].join(", ")}) и одна страна (${[...countries].join(", ") || "—"}), ` +
        "нужно ≥ 2 языков или стран",
    );
  }

  for (const [field, values] of [
    ["издатель", sources.map((s) => s.publisher.trim().toLowerCase())],
    ["домен", sources.map((s) => s.domain)],
  ] as const) {
    const repeated = [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
    if (repeated.length) reasons.push(`${field} повторяется: ${repeated.join(", ")}`);
  }

  const wanted = c.expect?.anyOfTypes;
  if (wanted && !sources.some((s) => wanted.includes(s.sourceType))) {
    reasons.push(`нет источника типа ${wanted.join(" | ")}`);
  }
  return reasons;
}

function describe(out: SourceSearchOutput): string[] {
  return [
    ...out.queries.map((q) => `запрос [${q.engine} ${q.language}] ${q.text}`),
    ...out.sources.map(
      (s) =>
        `источник ${s.sourceType.padEnd(17)} ${(s.country ?? "—").padEnd(2)} ${s.language}  ` +
        `${s.publisher} — ${s.url}`,
    ),
  ];
}

// ---------- валидация кейсов (без API) ----------

function validateCases(cases: SourceSearchCase[]): string[] {
  const out: string[] = [];
  const caseIds = new Set<string>();
  for (const c of cases) {
    const bad = (msg: string) => out.push(`${c.id}: ${msg}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) bad("id — латиница в нижнем регистре через дефис");
    if (caseIds.has(c.id)) bad("id повторяется");
    caseIds.add(c.id);
    if (!c.about.trim()) bad("пустое about");

    const { claim, maxSources, searchLanguages } = c.input;
    if (!claim.id.trim() || !claim.quote.trim() || !claim.normalized.trim())
      bad("пустые id / quote / normalized");
    if (!claim.entities.length || claim.entities.some((e) => !e.trim())) bad("entities пустые");
    if (!/^[a-z]{2}$/.test(claim.language)) bad(`claim.language ${claim.language}`);
    if (!(claim.checkworthiness >= 0 && claim.checkworthiness <= 1)) bad("checkworthiness вне 0..1");
    if (!searchLanguages.includes(claim.language) || !searchLanguages.includes("en")) {
      bad("searchLanguages должны включать язык тезиса и en (как в оркестраторе)");
    }
    if (new Set(searchLanguages).size !== searchLanguages.length) bad("searchLanguages с повторами");
    if (!(Number.isInteger(maxSources) && maxSources >= 3 && maxSources <= 6)) bad("maxSources — целое 3–6");
    const min = c.expect?.minSources ?? DEFAULT_MIN_SOURCES;
    if (!(Number.isInteger(min) && min >= 2 && min <= maxSources))
      bad("minSources — целое от 2 до maxSources");
    if (c.expect?.anyOfTypes && !c.expect.anyOfTypes.length) bad("пустой anyOfTypes");
  }
  return out;
}

// ---------- обвязка (такая же в eval 03 и 05: этапы не импортируют код друг друга) ----------

function missingConfig(): string[] {
  const { search, llm } = config.providers;
  return [
    search.provider !== "tavily" &&
      `SEARCH_PROVIDER=tavily${search.provider ? ` (сейчас «${search.provider}»)` : ""}`,
    !search.apiKey && "SEARCH_API_KEY",
    // запросы составляет LLM; без настроек LLM real.ts бросает LlmConfigError
    llm.provider !== "openai" && `LLM_PROVIDER=openai${llm.provider ? ` (сейчас «${llm.provider}»)` : ""}`,
    !llm.apiKey && "LLM_API_KEY",
    !llm.model && "LLM_MODEL",
  ].filter((m): m is string => typeof m === "string");
}

function parseArgs(argv: string[]): { only: string[]; verbose: boolean } | null {
  const args = { only: [] as string[], verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--only" || a.startsWith("--only=")) {
      const value = a === "--only" ? argv[++i] : a.slice("--only=".length);
      args.only.push(...(value ?? "").split(",").filter(Boolean));
    } else {
      console.error(`Неизвестный аргумент «${a}». Использование: run.ts [--only <id>[,<id>…]] [--verbose]`);
      return null;
    }
  }
  return args;
}

function pick<T extends { id: string }>(cases: T[], only: string[]): T[] | null {
  if (!only.length) return cases;
  const picked = cases.filter((c) => only.some((o) => c.id.includes(o)));
  if (!picked.length) {
    console.error(`Нет кейсов по --only ${only.join(",")}. Есть: ${cases.map((c) => c.id).join(", ")}`);
    return null;
  }
  return picked;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Таблица PASS/FAIL с причинами; подробности — по провалам (с --verbose — по всем). true, если всё прошло. */
function printReport(results: CaseResult[], verbose: boolean): boolean {
  const width = Math.max(...results.map((r) => r.id.length));
  console.log("\nРезультаты:");
  for (const r of results) {
    const head = `${r.reasons.length ? "FAIL" : "PASS"}  ${r.id.padEnd(width)}  ${(r.ms / 1000).toFixed(1).padStart(5)} с`;
    console.log(`${head}  ${r.reasons[0] ?? ""}`);
    for (const reason of r.reasons.slice(1)) console.log(`${" ".repeat(head.length)}  ${reason}`);
  }
  for (const r of results) {
    if (!verbose && !r.reasons.length) continue;
    console.log(`\n— ${r.id}`);
    for (const d of r.details.length ? r.details : ["(нет вывода)"]) console.log(`    ${d}`);
    for (const l of r.logs) console.log(`    лог: ${l}`);
  }
  const passed = results.filter((r) => !r.reasons.length).length;
  console.log(`\nИтог: ${passed}/${results.length} прошло`);
  return passed === results.length;
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
