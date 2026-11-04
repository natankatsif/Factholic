/**
 * Сквозной eval: материал как у пользователя (текст) → настоящий runPipeline → итоговые карточки.
 * Запускает те же этапы, что и сайт, и сверяет итог с эталоном из cases.ts.
 *
 * ВНИМАНИЕ: прогон ПЛАТНЫЙ. На кейс: LLM 5–12 вызовов, Tavily 7–15 запросов на каждое проверенное утверждение.
 * Режимы этапов передавай в команде, они важнее .env:
 *
 *   STAGES_DEFAULT=real STAGE_CLAIM_EXTRACTION=real STAGE_SOURCE_SEARCH=real STAGE_STANCES=real \
 *     npm run eval:pipeline -w backend -- --label baseline
 *   ... -- --label baseline --only soros,sperm     кейсы, чей id содержит подстроку
 *
 * Результат: tmp/eval/<label>/<кейс>.json и tmp/eval/<label>/summary.md (папка tmp в .gitignore).
 * Лимиты на человека не действуют: прогон идёт без IP, считается только дневной бюджет процесса.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FactCheck, ServerEvent, StartAnalysisRequest } from "@news/contracts";
import type { ClaimChecker } from "../checks.ts";
import { runPipeline } from "../orchestrator.ts";
import { CASES, type PipelineCase } from "./cases.ts";

const CASE_TIMEOUT_MS = 8 * 60_000;
const OUT_ROOT = fileURLToPath(new URL("../../../../tmp/eval/", import.meta.url));

export interface CaseScore {
  id: string;
  goal: 1 | 2;
  ok: boolean;
  error?: string;
  claims: number;
  main?: string;
  consensus?: string;
  summary?: string;
  acceptable: boolean;
  /** Ложное показано как подтверждённое: самая вредная ошибка */
  harmful: boolean;
  rootDate?: string;
  rootName?: string;
  rootUrl?: string;
  /** В окне эталона / раньше / позже / нет эталона / корня нет */
  root: "in_window" | "early" | "late" | "no_gold" | "no_root";
  expectedFound: string[];
  nodes: number;
  domains: number;
  confirmedEdges: number;
  probableEdges: number;
  sides?: string;
  flags: string[];
  sources: number;
  seconds: number;
}

process.exitCode = await main();

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const cases = args.only.length ? CASES.filter((c) => args.only.some((part) => c.id.includes(part))) : CASES;
  if (!cases.length) {
    console.error("Нет кейсов с такими id");
    return 1;
  }
  const dir = `${OUT_ROOT}${args.label}/`;
  mkdirSync(dir, { recursive: true });

  const scores: CaseScore[] = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: Math.min(args.parallel, queue.length) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const { score, report } = await runCase(c);
        scores.push(score);
        writeFileSync(`${dir}${c.id}.json`, JSON.stringify({ case: c, score, report }, null, 2));
        console.error(`готово: ${c.id} ${score.consensus ?? score.error ?? ""} (${score.seconds} с)`);
      }
    }),
  );

  scores.sort((a, b) => cases.findIndex((c) => c.id === a.id) - cases.findIndex((c) => c.id === b.id));
  writeFileSync(`${dir}summary.md`, summary(args.label, scores));
  writeFileSync(`${dir}scores.json`, JSON.stringify(scores, null, 2));
  console.error(`итог: ${dir}summary.md`);
  return 0;
}

async function runCase(c: PipelineCase): Promise<{ score: CaseScore; report: FactCheck[] }> {
  const started = Date.now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CASE_TIMEOUT_MS);
  const jobId = `eval_${c.id}_${randomUUID().slice(0, 6)}`;
  const request: StartAnalysisRequest = {
    video: { pageUrl: `https://eval.local/${c.id}`, platform: "generic" },
    mode: "remote",
    startFrom: 0,
    languageHint: c.language,
    uiLanguage: "ru",
    text: c.text,
  };
  let checker: ClaimChecker | undefined;
  let failure: string | undefined;
  const emit = (e: ServerEvent) => {
    if (e.type === "job.failed") failure = e.error.message;
  };
  try {
    await runPipeline({ jobId, request, emit, signal: abort.signal, onChecker: (x) => (checker = x) });
    await checker?.whenIdle();
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
  const report = checker?.factChecks() ?? [];
  return { report, score: scoreCase(c, report, Math.round((Date.now() - started) / 1000), failure) };
}

/** Главное утверждение материала: больше всего слов из эталона */
function pickMain(c: PipelineCase, report: FactCheck[]): FactCheck | undefined {
  const hits = (fc: FactCheck) => {
    const text = `${fc.claim} ${fc.quote}`.toLowerCase();
    return c.gold.keywords.filter((k) => text.includes(k.toLowerCase())).length;
  };
  return [...report].sort((a, b) => hits(b) - hits(a))[0];
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

export function scoreCase(c: PipelineCase, report: FactCheck[], seconds: number, error?: string): CaseScore {
  const main = pickMain(c, report);
  const nodes = (main?.provenance?.nodes ?? []).filter((n) => n.role !== "target");
  const root = nodes.find((n) => n.isPrimary);
  const hosts = new Set([
    ...nodes.map((n) => hostOf(n.url)),
    ...(main?.sources ?? []).map((s) => hostOf(s.url)),
  ]);
  hosts.delete("");
  const expectedFound = c.gold.expectDomains.filter((d) =>
    [...hosts].some((h) => h === d || h.endsWith(`.${d}`)),
  );
  const rootDay = root?.isoDate?.slice(0, 10);
  const window = c.gold.rootWindow;
  const rootStatus: CaseScore["root"] = !root
    ? "no_root"
    : !window || !rootDay
      ? "no_gold"
      : rootDay < window.from
        ? "early"
        : rootDay > window.to
          ? "late"
          : "in_window";
  const edges = main?.provenance?.edges ?? [];
  const consensus = main?.status === "done" ? main.consensus : undefined;
  return {
    id: c.id,
    goal: c.goal,
    ok: main?.status === "done",
    error: error ?? (main?.status === "failed" ? main.error : main ? undefined : "утверждений нет"),
    claims: report.length,
    main: main?.claim,
    consensus,
    summary: main?.consensusSummary,
    acceptable: consensus !== undefined && c.gold.acceptable.includes(consensus),
    harmful: c.gold.misleading && consensus === "converge",
    rootDate: rootDay,
    rootName: root?.name,
    rootUrl: root?.url,
    root: rootStatus,
    expectedFound,
    nodes: nodes.length,
    domains: hosts.size,
    confirmedEdges: edges.filter((e) => e.relationType === "direct").length,
    probableEdges: edges.filter((e) => e.relationType !== "direct").length,
    sides: main?.sides ? `${main.sides.for}/${main.sides.against}/${main.sides.mixed}` : undefined,
    flags: (main?.flags ?? []).map((f) => f.label),
    sources: main?.sources.length ?? 0,
    seconds,
  };
}

function summary(label: string, scores: CaseScore[]): string {
  const count = (fn: (s: CaseScore) => boolean) => scores.filter(fn).length;
  const rows = scores.map((s) =>
    [
      s.id,
      s.goal,
      s.consensus ?? `ошибка: ${s.error ?? "?"}`,
      s.acceptable ? "да" : "нет",
      s.harmful ? "ДА" : "",
      `${s.root}${s.rootDate ? ` ${s.rootDate}` : ""}`,
      s.expectedFound.join(", ") || "—",
      `${s.nodes}/${s.domains}`,
      `${s.confirmedEdges}/${s.probableEdges}`,
      s.sides ?? "—",
      s.flags.join(", ") || "—",
      s.seconds,
    ].join(" | "),
  );
  return [
    `# Прогон ${label}`,
    "",
    `Кейсов: ${scores.length}. Итог допустим: ${count((s) => s.acceptable)}. Вредных ошибок: ${count((s) => s.harmful)}.`,
    `Корень в окне эталона: ${count((s) => s.root === "in_window")} из ${count((s) => s.root !== "no_gold" || !s.rootDate)}.`,
    `Найден ожидаемый домен: ${count((s) => s.expectedFound.length > 0)}.`,
    "",
    "| кейс | цель | итог | допустим | вред | корень | ожидаемые домены | узлы/домены | рёбра точн./вер. | за/против/частично | флаги | сек |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r} |`),
    "",
  ].join("\n");
}

function parseArgs(argv: string[]): { label: string; only: string[]; parallel: number } {
  const value = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    label: value("--label") ?? "run",
    only: (value("--only") ?? "").split(",").filter(Boolean),
    // ключ разработчика Tavily блокируется за частые запросы: кейсов одновременно меньше, чем кажется безопасным
    parallel: Number(value("--parallel") ?? 1),
  };
}
