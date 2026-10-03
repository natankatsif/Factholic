/**
 * Eval этапа 03: прогоняет кейсы из eval/cases.ts через настоящую реализацию (real.ts) и сверяет с ожиданиями.
 *
 * ВНИМАНИЕ: прогон ПЛАТНЫЙ — каждый кейс = реальный запрос к LLM (OpenAI; LLM_PROVIDER / LLM_API_KEY /
 * LLM_MODEL в корневом .env). STAGE_CLAIM_EXTRACTION не важен: eval всегда вызывает real.
 *
 *   npm run eval:03 -w backend                              все кейсы
 *   npm run eval:03 -w backend -- --only ru-prediction      кейсы, чей id содержит подстроку (можно через запятую)
 *   npm run eval:03 -w backend -- --verbose                 + все тезисы и лог этапа по каждому кейсу
 *
 * Без настроек LLM запросов нет: скрипт только проверяет, что кейсы корректны, и выходит с кодом 0.
 * С настройками — код 1, если провален хотя бы один кейс.
 */
import { inspect } from "node:util";
import type { TimeRange } from "@news/contracts";
import { config } from "../../../config.ts";
import type { StageContext } from "../../../pipeline/context.ts";
import type { TranscriptSegment } from "../../02-transcription/types.ts";
import { extractClaimsReal } from "../real.ts";
import { CHECKWORTHINESS_THRESHOLD, type Claim } from "../types.ts";
import { CASES, type ClaimExtractionCase, type ExpectedClaim, type Keyword } from "./cases.ts";

const CONCURRENCY = 3;
const TIMEOUT_MS = 120_000;
const LANGUAGES = ["ru", "en", "uk"];
/** Допуск на округление таймкодов */
const EPS = 0.05;
/** range может выйти за конец сегмента на минимальную длину отрезка (MIN_DURATION_SEC в range.ts) */
const END_SLACK = 0.55;
/** Доля слов quote, которые должны найтись в тексте его сегментов («дословный фрагмент») */
const QUOTE_MIN_SHARE = 0.75;

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
    console.log(`Кейсы этапа 03 корректны: ${CASES.length} (выбрано ${cases.length}).`);
    console.log(
      `Нужен ключ LLM — не заданы ${missing.join(", ")} (корневой .env). Реальный прогон пропущен.`,
    );
    return 0;
  }

  console.log(
    `Eval 03 · модель ${config.providers.llm.model} · кейсов ${cases.length} · ` +
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

async function runCase(c: ClaimExtractionCase): Promise<CaseResult> {
  const logs: string[] = [];
  const ctx: StageContext = {
    jobId: "eval",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    log: (msg, data) =>
      logs.push(data === undefined ? msg : `${msg} ${inspect(data, { depth: 2, breakLength: Infinity })}`),
  };
  const started = performance.now();
  try {
    const { claims } = await extractClaimsReal(c.input, ctx);
    return {
      id: c.id,
      ms: performance.now() - started,
      reasons: checkCase(c, claims, logs),
      details: claims.map(describeClaim),
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

function checkCase(c: ClaimExtractionCase, claims: Claim[], logs: string[]): string[] {
  const reasons: string[] = [];
  // real.ts при временном сбое LLM молча возвращает [] — иначе такой кейс «прошёл» бы как «тезисов нет»
  if (logs.some((l) => l.includes("кусок пропущен"))) {
    reasons.push("LLM не ответила, real.ts вернул пустой список (см. лог)");
  }
  reasons.push(...invariants(c, claims));

  const worthy = claims.filter((cl) => cl.checkworthiness >= CHECKWORTHINESS_THRESHOLD);
  const { min, max } = c.expect.claims;
  if (worthy.length < min || worthy.length > max) {
    reasons.push(
      `тезисов с checkworthiness ≥ ${CHECKWORTHINESS_THRESHOLD}: ${worthy.length}, ` +
        `ожидалось ${min === max ? min : `${min}–${max}`}`,
    );
  }
  reasons.push(...matchExpected(c.expect.expected ?? [], worthy));

  for (const f of c.expect.forbidden ?? []) {
    const pool = f.scope === "all" ? claims : worthy;
    const hit = pool.find((cl) => hasKeywords(cl.normalized, f.keywords));
    if (hit) reasons.push(`лишний тезис (${f.why}): «${hit.normalized}»`);
  }
  return reasons;
}

/** То, что должно выполняться для любого тезиса, независимо от кейса */
function invariants({ input }: ClaimExtractionCase, claims: Claim[]): string[] {
  const out: string[] = [];
  const segmentsById = new Map(input.segments.map((s) => [s.id, s]));
  const ids = new Set<string>();
  for (const cl of claims) {
    const tag = `«${short(cl.normalized)}»`;
    if (ids.has(cl.id)) out.push(`${tag}: id ${cl.id} повторяется`);
    ids.add(cl.id);
    if (cl.jobId !== input.jobId) out.push(`${tag}: jobId ${cl.jobId} ≠ ${input.jobId}`);
    if (cl.language !== input.language) out.push(`${tag}: language ${cl.language} ≠ ${input.language}`);
    if (!(cl.checkworthiness >= 0 && cl.checkworthiness <= 1)) {
      out.push(`${tag}: checkworthiness ${cl.checkworthiness} вне 0..1`);
    }
    if (!cl.quote.trim() || !cl.normalized.trim()) out.push(`${tag}: пустой quote или normalized`);

    const segments = cl.segmentIds
      .map((id) => segmentsById.get(id))
      .filter((s): s is TranscriptSegment => s !== undefined);
    if (!segments.length || segments.length !== cl.segmentIds.length) {
      out.push(`${tag}: segmentIds [${cl.segmentIds.join(", ")}] не из НОВОГО ТЕКСТА`);
      continue;
    }
    const start = Math.min(...segments.map((s) => s.start));
    const end = Math.max(...segments.map((s) => s.end));
    if (!(cl.range.start <= cl.range.end) || cl.range.start < start - EPS || cl.range.end > end + END_SLACK) {
      out.push(`${tag}: range ${fmtRange(cl.range)} вне своих сегментов ${fmtRange({ start, end })}`);
    }
    const share = quoteShare(cl.quote, segments.map((s) => s.text).join(" "));
    if (share < QUOTE_MIN_SHARE) {
      out.push(
        `${tag}: quote не дословный (в сегментах ${Math.round(share * 100)}% его слов): «${cl.quote}»`,
      );
    }
  }
  return out;
}

function failureOf(e: ExpectedClaim, cl: Claim): string | null {
  if (!hasKeywords(cl.normalized, e.keywords)) return "нет ключевых слов";
  if (e.category && !e.category.includes(cl.category)) {
    return `category ${cl.category}, ожидалось ${e.category.join(" | ")}`;
  }
  if (e.segmentIds) {
    const absent = e.segmentIds.filter((id) => !cl.segmentIds.includes(id));
    if (absent.length) return `segmentIds [${cl.segmentIds.join(", ")}] без ${absent.join(", ")}`;
  }
  if (e.within && (cl.range.start < e.within.start - EPS || cl.range.end > e.within.end + EPS)) {
    return `range ${fmtRange(cl.range)} вне ожидаемого ${fmtRange(e.within)}`;
  }
  if (e.forbidWords) {
    const tokens = new Set(wordsOf(cl.normalized));
    const left = e.forbidWords.filter((w) => tokens.has(norm(w)));
    if (left.length) return `в normalized остались слова «${left.join("», «")}»`;
  }
  return null;
}

/** Каждому ожиданию — свой тезис (перебор: один тезис не может закрыть два ожидания) */
function matchExpected(expected: ExpectedClaim[], claims: Claim[]): string[] {
  const used = new Set<number>();
  const assign = (i: number): boolean => {
    if (i === expected.length) return true;
    for (let j = 0; j < claims.length; j++) {
      if (used.has(j) || failureOf(expected[i], claims[j]) !== null) continue;
      used.add(j);
      if (assign(i + 1)) return true;
      used.delete(j);
    }
    return false;
  };
  if (assign(0)) return [];

  const reasons = expected.flatMap((e) => {
    const keys = fmtKeywords(e.keywords);
    const withKeys = claims.filter((cl) => hasKeywords(cl.normalized, e.keywords));
    if (!withKeys.length) return [`нет тезиса с ключами ${keys}`];
    const failures = withKeys.map((cl) => failureOf(e, cl));
    if (failures.every((f) => f !== null)) return [`тезис с ключами ${keys}: ${failures[0]}`];
    return [];
  });
  return reasons.length ? reasons : ["один тезис закрывает несколько ожиданий — факты не разделены?"];
}

// ---------- текст ----------

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’ʼ`´]/g, "'")
    .replace(/(\d)\s(?=\d{3}(?!\d))/g, "$1");
}

function hasKeywords(text: string, keywords: Keyword[]): boolean {
  const t = norm(text);
  return keywords.every((k) => (typeof k === "string" ? [k] : k).some((alt) => t.includes(norm(alt))));
}

function wordsOf(text: string): string[] {
  return norm(text)
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
}

/** Доля слов цитаты (по первым 5 буквам, числа целиком), которые есть в тексте */
function quoteShare(quote: string, text: string): number {
  const stem = (w: string) => (/^\p{N}+$/u.test(w) ? w : w.slice(0, 5));
  const q = wordsOf(quote).map(stem);
  if (!q.length) return 0;
  const present = new Set(wordsOf(text).map(stem));
  return q.filter((w) => present.has(w)).length / q.length;
}

function fmtKeywords(keywords: Keyword[]): string {
  return keywords.map((k) => (typeof k === "string" ? k : k.join("|"))).join(" + ");
}

function fmtRange(r: TimeRange): string {
  return `${r.start.toFixed(2)}–${r.end.toFixed(2)}`;
}

function short(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function describeClaim(cl: Claim): string {
  return (
    `${cl.checkworthiness.toFixed(2)} ${cl.category.padEnd(10)} ${fmtRange(cl.range)} ` +
    `[${cl.segmentIds.join(",")}] «${cl.normalized}» ← «${cl.quote}»`
  );
}

// ---------- валидация кейсов (без API) ----------

function validateCases(cases: ClaimExtractionCase[]): string[] {
  const out: string[] = [];
  const caseIds = new Set<string>();
  for (const c of cases) {
    const bad = (msg: string) => out.push(`${c.id}: ${msg}`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) bad("id — латиница в нижнем регистре через дефис");
    if (caseIds.has(c.id)) bad("id повторяется");
    caseIds.add(c.id);
    if (!c.about.trim()) bad("пустое about");

    const { input, expect } = c;
    if (input.jobId !== "eval") bad('jobId должен быть "eval"');
    if (!LANGUAGES.includes(input.language))
      bad(`language ${input.language}, ожидается ${LANGUAGES.join(" | ")}`);
    if (input.video.language !== input.language) bad("video.language ≠ language");
    if (!input.segments.length) bad("нет новых сегментов");

    const segmentIds = new Set<string>();
    for (const s of [...input.context, ...input.segments]) {
      if (!/^\d+_\d+$/.test(s.id)) bad(`сегмент ${s.id}: id не вида seq_index`);
      if (segmentIds.has(s.id)) bad(`сегмент ${s.id}: id повторяется`);
      segmentIds.add(s.id);
      if (!(s.start >= 0 && s.start < s.end)) bad(`сегмент ${s.id}: неверные start/end`);
      if (!s.text.trim()) bad(`сегмент ${s.id}: пустой text`);
      if (!s.words) continue;
      if (s.words.map((w) => w.text).join(" ") !== s.text.split(/\s+/).filter(Boolean).join(" ")) {
        bad(`сегмент ${s.id}: words не совпадают с text`);
      }
      let prev = s.start;
      for (const w of s.words) {
        if (w.start < prev - 1e-6 || w.end < w.start || w.end > s.end + 1e-6) {
          bad(`сегмент ${s.id}: слово «${w.text}» вне порядка или вне границ сегмента`);
          break;
        }
        prev = w.end;
      }
    }
    for (const list of [input.context, input.segments]) {
      for (let i = 1; i < list.length; i++) {
        if (list[i].start < list[i - 1].end) bad(`сегменты ${list[i - 1].id} и ${list[i].id} не по порядку`);
      }
    }
    if (input.context.length && input.segments.length) {
      if (Math.max(...input.context.map((s) => s.end)) > input.segments[0].start) {
        bad("КОНТЕКСТ должен заканчиваться до начала новых сегментов");
      }
    }
    const previousIds = new Set<string>();
    for (const p of input.previousClaims) {
      if (previousIds.has(p.id)) bad(`previousClaims: id ${p.id} повторяется`);
      previousIds.add(p.id);
      if (!p.normalized.trim()) bad(`previousClaims ${p.id}: пустой normalized`);
    }

    const { min, max } = expect.claims;
    if (!(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && min <= max)) {
      bad("claims: нужно целые 0 ≤ min ≤ max");
    }
    const expected = expect.expected ?? [];
    if (expected.length > max) bad("ожидаемых тезисов больше, чем claims.max");
    const newStart = Math.min(...input.segments.map((s) => s.start));
    const newEnd = Math.max(...input.segments.map((s) => s.end));
    expected.forEach((e, i) => {
      if (!e.keywords.length || e.keywords.some(isEmptyKeyword)) bad(`expected[${i}]: пустые keywords`);
      if (e.category && !e.category.length) bad(`expected[${i}]: пустой список category`);
      if (
        e.within &&
        !(e.within.start < e.within.end && e.within.start < newEnd && e.within.end > newStart)
      ) {
        bad(`expected[${i}]: within ${fmtRange(e.within)} не пересекается с новыми сегментами`);
      }
      const notNew = (e.segmentIds ?? []).filter((id) => !input.segments.some((s) => s.id === id));
      if (notNew.length) bad(`expected[${i}]: segmentIds ${notNew.join(", ")} не из новых сегментов`);
    });
    (expect.forbidden ?? []).forEach((f, i) => {
      if (!f.keywords.length || f.keywords.some(isEmptyKeyword)) bad(`forbidden[${i}]: пустые keywords`);
      if (!f.why.trim()) bad(`forbidden[${i}]: пустое why`);
    });
  }
  return out;
}

function isEmptyKeyword(k: Keyword): boolean {
  return typeof k === "string" ? !k.trim() : !k.length || k.some((alt) => !alt.trim());
}

// ---------- обвязка (такая же в eval 04 и 05: этапы не импортируют код друг друга) ----------

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
    for (const d of r.details.length ? r.details : ["(тезисов нет)"]) console.log(`    ${d}`);
    for (const l of r.logs) console.log(`    лог: ${l}`);
  }
  const passed = results.filter((r) => !r.reasons.length).length;
  console.log(`\nИтог: ${passed}/${results.length} прошло`);
  return passed === results.length;
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
