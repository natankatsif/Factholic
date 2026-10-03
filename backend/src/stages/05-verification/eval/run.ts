/**
 * Eval этапа 05: прогоняет кейсы из eval/cases.ts через настоящую реализацию (real.ts) и сверяет с ожиданиями.
 *
 * ВНИМАНИЕ: прогон ПЛАТНЫЙ — каждый кейс (кроме кейса без источников) = реальный запрос к LLM
 * (OpenAI; LLM_PROVIDER / LLM_API_KEY / LLM_MODEL в корневом .env). STAGE_VERIFICATION не важен: eval всегда
 * вызывает real.
 *
 *   npm run eval:05 -w backend                              все кейсы
 *   npm run eval:05 -w backend -- --only injection          кейсы, чей id содержит подстроку (можно через запятую)
 *   npm run eval:05 -w backend -- --verbose                 + вердикт и лог этапа по каждому кейсу
 *
 * Без настроек LLM запросов нет: скрипт только проверяет, что кейсы корректны, и выходит с кодом 0.
 * С настройками — код 1, если провален хотя бы один кейс.
 */
import { inspect } from "node:util";
import type { VerdictLabel } from "@news/contracts";
import { config } from "../../../config.ts";
import type { StageContext } from "../../../pipeline/context.ts";
import { verifyReal } from "../real.ts";
import { LABELS, SCORE_RANGE } from "../scale.ts";
import type { VerificationInput, VerificationOutput } from "../types.ts";
import { CASES, type VerificationCase } from "./cases.ts";

const CONCURRENCY = 3;
const TIMEOUT_MS = 180_000;
/** Языки UI, для которых умеем проверять алфавит текстов */
const UI_LANGUAGES = ["ru", "uk", "en"];
/** summary — одно короткое предложение для бейджа */
const SUMMARY_MAX_CHARS = 300;

/**
 * Простая эвристика нейтральности: оценочные слова и вводные с позицией автора.
 * Ищутся с начала слова («очевидн» не срабатывает на «неочевидно»).
 */
const NON_NEUTRAL: Record<string, string[]> = {
  ru: [
    "позорн",
    "возмутительн",
    "чудовищн",
    "ужасн",
    "отвратительн",
    "лжив",
    "наглая",
    "наглую",
    "бредов",
    "абсурдн",
    "смехотворн",
    "нелеп",
    "вопиющ",
    "шокирующ",
    "скандальн",
    "пропаганд",
    "так называем",
    "к сожалению",
    "к счастью",
    "безусловно",
    "разумеется",
    "очевидно",
  ],
  uk: [
    "ганебн",
    "обурлив",
    "жахлив",
    "огидн",
    "брехлив",
    "нахабн",
    "абсурдн",
    "безглузд",
    "шокуюч",
    "скандальн",
    "пропаганд",
    "так званий",
    "так звана",
    "так зване",
    "на жаль",
    "на щастя",
    "безумовно",
    "звісно",
    "очевидно",
  ],
  en: [
    "shameful",
    "outrageous",
    "disgraceful",
    "disgusting",
    "appalling",
    "blatant",
    "absurd",
    "ridiculous",
    "laughable",
    "nonsense",
    "shocking",
    "propaganda",
    "so-called",
    "fortunately",
    "unfortunately",
    "obviously",
  ],
};

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
    console.log(`Кейсы этапа 05 корректны: ${CASES.length} (выбрано ${cases.length}).`);
    console.log(
      `Нужен ключ LLM — не заданы ${missing.join(", ")} (корневой .env). Реальный прогон пропущен.`,
    );
    return 0;
  }

  console.log(
    `Eval 05 · модель ${config.providers.llm.model} · кейсов ${cases.length} · ` +
      `параллельно ${CONCURRENCY}. Прогон платный.\n`,
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

async function runCase(c: VerificationCase): Promise<CaseResult> {
  const logs: string[] = [];
  const ctx: StageContext = {
    jobId: "eval",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    log: (msg, data) =>
      logs.push(data === undefined ? msg : `${msg} ${inspect(data, { depth: 2, breakLength: Infinity })}`),
  };
  const started = performance.now();
  try {
    const out = await verifyReal(c.input, ctx);
    return {
      id: c.id,
      ms: performance.now() - started,
      reasons: [...invariants(c.input, out), ...expectations(c, out)],
      details: describe(out),
      logs,
    };
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

/** Принципы продукта и контракт выхода — для любого кейса */
function invariants(input: VerificationInput, out: VerificationOutput): string[] {
  const reasons: string[] = [];
  if (out.claimId !== input.claim.id) reasons.push(`claimId ${out.claimId} ≠ ${input.claim.id}`);

  if (out.label === "unverifiable") {
    if (out.score !== null) reasons.push(`unverifiable со score ${out.score} (должен быть null)`);
  } else if (out.score === null) {
    reasons.push(`score null при label ${out.label}`);
  } else {
    const [min, max] = SCORE_RANGE[out.label];
    if (!Number.isInteger(out.score) || out.score < min || out.score > max) {
      reasons.push(`score ${out.score} вне шкалы для ${out.label} (${min}–${max})`);
    }
  }
  if (!(out.confidence >= 0 && out.confidence <= 1)) reasons.push(`confidence ${out.confidence} вне 0..1`);

  const ids = out.sourceAssessments.map((a) => a.sourceId).join(",");
  const expectedIds = input.sources.map((s) => s.id).join(",");
  if (ids !== expectedIds) reasons.push(`sourceAssessments [${ids}] ≠ источникам [${expectedIds}]`);
  for (const a of out.sourceAssessments) {
    if (!(a.relevance >= 0 && a.relevance <= 1))
      reasons.push(`${a.sourceId}: relevance ${a.relevance} вне 0..1`);
  }

  if (!out.summary.trim() || !out.explanation.trim()) reasons.push("пустой summary или explanation");
  if (out.summary.length > SUMMARY_MAX_CHARS) {
    reasons.push(`summary длиннее ${SUMMARY_MAX_CHARS} символов (${out.summary.length})`);
  }
  reasons.push(...languageProblems(out, input.uiLanguage));

  const text = `${out.summary}\n${out.explanation}`;
  const loaded = (NON_NEUTRAL[input.uiLanguage] ?? []).filter((w) => startsWord(text, w));
  if (loaded.length) reasons.push(`не нейтрально: «${loaded.join("», «")}»`);
  return reasons;
}

function expectations(c: VerificationCase, out: VerificationOutput): string[] {
  const reasons: string[] = [];
  const { labels, score, stances, forbiddenText } = c.expect;
  if (!labels.includes(out.label)) reasons.push(`label ${out.label}, ожидалось ${labels.join(" | ")}`);
  if (score && out.score !== null && (out.score < score[0] || out.score > score[1])) {
    reasons.push(`score ${out.score}, ожидалось ${score[0]}–${score[1]}`);
  }
  for (const [sourceId, allowed] of Object.entries(stances ?? {})) {
    const a = out.sourceAssessments.find((x) => x.sourceId === sourceId);
    if (a && !allowed.includes(a.stance)) {
      reasons.push(`${sourceId}: stance ${a.stance}, ожидалось ${allowed.join(" | ")}`);
    }
  }
  const text = `${out.summary}\n${out.explanation}`.toLowerCase();
  const found = (forbiddenText ?? []).filter((f) => text.includes(f.toLowerCase()));
  if (found.length) reasons.push(`в тексте есть «${found.join("», «")}»`);
  return reasons;
}

/** Язык summary / explanation по алфавиту: латиница для en, кириллица для ru/uk + буквы, которых нет в другом */
function languageProblems(out: VerificationOutput, uiLanguage: string): string[] {
  const reasons: string[] = [];
  for (const [field, text] of [
    ["summary", out.summary],
    ["explanation", out.explanation],
  ] as const) {
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    if (!letters) continue;
    const share = (re: RegExp) => (text.match(re)?.length ?? 0) / letters;
    if (uiLanguage === "en" && share(/\p{Script=Latin}/gu) < 0.8) {
      reasons.push(`${field} не на английском`);
    }
    if ((uiLanguage === "ru" || uiLanguage === "uk") && share(/\p{Script=Cyrillic}/gu) < 0.6) {
      reasons.push(`${field} не на кириллице (uiLanguage ${uiLanguage})`);
    }
  }
  const all = `${out.summary} ${out.explanation}`;
  const count = (re: RegExp) => all.match(re)?.length ?? 0;
  // і/ї/є/ґ есть почти в любой украинской фразе и нет в русском; ы/э/ъ — наоборот.
  // Небольшой допуск — на имена собственные в другом написании.
  const ukLetters = count(/[іїєґ]/giu);
  const ruLetters = count(/[ыэъ]/giu);
  if (uiLanguage === "uk" && (ukLetters < 2 || ruLetters > 1)) {
    reasons.push(`тексты не на украинском (і/ї/є/ґ: ${ukLetters}, ы/э/ъ: ${ruLetters})`);
  }
  if (uiLanguage === "ru" && ukLetters > ruLetters + 2) {
    reasons.push(`тексты не на русском (і/ї/є/ґ: ${ukLetters}, ы/э/ъ: ${ruLetters})`);
  }
  return reasons;
}

function startsWord(text: string, stem: string): boolean {
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\p{L})${escaped}`, "iu").test(text);
}

function describe(out: VerificationOutput): string[] {
  return [
    `${out.label} · score ${out.score ?? "null"} · confidence ${out.confidence.toFixed(2)} · ${out.model}`,
    `summary: ${out.summary}`,
    `explanation: ${out.explanation}`,
    `источники: ${out.sourceAssessments.map((a) => `${a.sourceId}=${a.stance}/${a.relevance.toFixed(2)}`).join("  ")}`,
  ];
}

// ---------- валидация кейсов (без API) ----------

function validateCases(cases: VerificationCase[]): string[] {
  const out: string[] = [];
  const caseIds = new Set<string>();
  for (const c of cases) {
    const bad = (msg: string) => out.push(`${c.id}: ${msg}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) bad("id — латиница в нижнем регистре через дефис");
    if (caseIds.has(c.id)) bad("id повторяется");
    caseIds.add(c.id);
    if (!c.about.trim()) bad("пустое about");

    const { claim, sources, uiLanguage } = c.input;
    if (!UI_LANGUAGES.includes(uiLanguage))
      bad(`uiLanguage ${uiLanguage}: проверка языка есть только для ru | uk | en`);
    if (!claim.id.trim() || !claim.quote.trim() || !claim.normalized.trim())
      bad("пустые id / quote / normalized");
    if (!(claim.checkworthiness >= 0 && claim.checkworthiness <= 1)) bad("checkworthiness вне 0..1");
    if (!(claim.range.start <= claim.range.end)) bad("range.start > range.end");
    if (!/^[a-z]{2}$/.test(claim.language)) bad(`claim.language ${claim.language}`);
    if (!c.input.surroundingText.includes(claim.quote.slice(1, 20))) bad("surroundingText не содержит quote");

    const sourceIds = new Set<string>();
    for (const s of sources) {
      const tag = `источник ${s.id}`;
      if (sourceIds.has(s.id)) bad(`${tag}: id повторяется`);
      sourceIds.add(s.id);
      let host = "";
      try {
        const url = new URL(s.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") bad(`${tag}: url не http(s)`);
        host = url.hostname.replace(/^www\./, "");
      } catch {
        bad(`${tag}: неверный url`);
      }
      if (host && s.domain !== host) bad(`${tag}: domain ${s.domain} ≠ ${host}`);
      if (!s.title.trim() || !s.publisher.trim()) bad(`${tag}: пустые title / publisher`);
      if (!s.excerpt.trim() || !s.snippet.trim()) bad(`${tag}: пустые excerpt / snippet`);
      if (!/^[a-z]{2}$/.test(s.language)) bad(`${tag}: language ${s.language}`);
      if (s.country !== undefined && !/^[A-Z]{2}$/.test(s.country)) bad(`${tag}: country ${s.country}`);
      if (!(s.domainReliability >= 0 && s.domainReliability <= 1)) bad(`${tag}: domainReliability вне 0..1`);
      for (const date of [s.publishedAt, s.retrievedAt]) {
        if (date !== undefined && Number.isNaN(Date.parse(date))) bad(`${tag}: дата ${date} не ISO`);
      }
    }

    const { labels, score, stances, forbiddenText } = c.expect;
    if (!labels.length || new Set(labels).size !== labels.length) bad("labels пустой или с повторами");
    if (labels.some((l) => !(LABELS as readonly string[]).includes(l))) bad("неизвестная метка в labels");
    const graded = labels.filter((l): l is Exclude<VerdictLabel, "unverifiable"> => l !== "unverifiable");
    if (!graded.length && score) bad("для unverifiable score не задаётся (он всегда null)");
    if (graded.length && !score) bad("для оценок с баллом нужен диапазон score");
    if (score) {
      const [min, max] = score;
      if (!(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && min <= max && max <= 10)) {
        bad("score: нужно целые 0 ≤ min ≤ max ≤ 10");
      }
      for (const l of graded) {
        const [lo, hi] = SCORE_RANGE[l];
        if (hi < min || lo > max) bad(`score ${min}–${max} не пересекается со шкалой ${l} (${lo}–${hi})`);
      }
    }
    for (const id of Object.keys(stances ?? {})) if (!sourceIds.has(id)) bad(`stances: нет источника ${id}`);
    if ((forbiddenText ?? []).some((f) => !f.trim())) bad("пустая строка в forbiddenText");
    if (claim.category === "prediction" && !labels.includes("unverifiable"))
      bad("прогноз должен ждать unverifiable");
    if (!sources.length && (labels.length !== 1 || labels[0] !== "unverifiable")) {
      bad("без источников допустим только unverifiable");
    }
  }
  return out;
}

// ---------- обвязка (такая же в eval 03 и 04: этапы не импортируют код друг друга) ----------

function missingConfig(): string[] {
  const { provider, apiKey, model } = config.providers.llm;
  return [
    provider !== "openai" && `LLM_PROVIDER=openai${provider ? ` (сейчас «${provider}»)` : ""}`,
    !apiKey && "LLM_API_KEY",
    !model && "LLM_MODEL",
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
