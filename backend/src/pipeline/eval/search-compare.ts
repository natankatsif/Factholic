/**
 * Сравнение поиска копий: прежний режим и поиск по следам, на одних и тех же запросах, без LLM.
 * Запросы написаны вручную, чтобы сравнивать только поиск. Если LLM недоступна, фильтр «то же событие»
 * пропускается в обоих режимах, поэтому в выдаче больше шума: смотри не только самую раннюю дату.
 *
 * ПЛАТНО: Tavily, примерно 4 кредита на кейс в прежнем режиме и до 25 в режиме следов.
 *   STAGES_DEFAULT=mock STAGE_CLAIM_EXTRACTION=mock STAGE_SOURCE_SEARCH=mock STAGE_STANCES=mock \
 *     npm run eval:search -w backend
 * Результат: tmp/eval/search-compare/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Claim } from "../../stages/03-claim-extraction/index.ts";
import { findCopiesWithTraces, type CopiesResult } from "../../stages/04-source-search/copies.ts";
import type { PlannedQuery } from "../../stages/04-source-search/queries.ts";
import type { StageContext } from "../context.ts";
import { CASES, type PipelineCase } from "./cases.ts";

const OUT = fileURLToPath(new URL("../../../../tmp/eval/search-compare/", import.meta.url));

/** ro, ru, en: так же нейтрально, как просит промпт этапа 04 */
const QUERIES: Record<string, [string, string, string]> = {
  "migrants-300k": [
    "Osmochescu 300 de mii lucrători străini Moldova",
    "Осмокеску 300 тысяч работников Молдова",
    "Moldova 300,000 foreign workers minister Osmochescu",
  ],
  "dereneu-church": [
    "biserica Dereneu Mitropolia Basarabiei decizie",
    "храм Деренеу Митрополия Бессарабии решение суда",
    "Dereneu church Moldova court Metropolis Bessarabia",
  ],
  "transnistria-mines": [
    "Ucraina a minat frontiera cu Transnistria Podoliak",
    "Украина заминировала границу с Приднестровьем Подоляк",
    "Ukraine mined border Transnistria Podolyak",
  ],
  "usaid-sandu": [
    "USAID finanțare Maia Sandu alegeri 2024 diaspora",
    "USAID Санду выборы 2024 диаспора финансирование",
    "USAID Maia Sandu 2024 election funding diaspora",
  ],
  "gas-blocked": [
    "gaz rusesc Transnistria sistare ianuarie 2025 Gazprom Chișinău",
    "прекращение поставок газа Приднестровье январь 2025 Газпром Кишинёв",
    "Transnistria gas supply halted January 2025 Gazprom Moldova",
  ],
  "nato-70k": [
    "70.000 soldați NATO România Odesa",
    "70 тысяч солдат НАТО Румыния Одесса",
    "70,000 NATO soldiers Romania Odesa",
  ],
  "soros-lgbt": [
    "Fundația Soros 10 milioane euro LGBT Moldova Maia Sandu",
    "фонд Сороса 10 миллионов евро ЛГБТ Молдова Санду",
    "Soros 10 million euros LGBT Moldova Sandu Proud Europe",
  ],
  "sandu-sperm": [
    "Maia Sandu spermă Elton John OK Magazine",
    "Санду сперма Элтон Джон OK Magazine",
    "Maia Sandu sperm Elton John OK Magazine fake",
  ],
  "istanbul-convention": [
    "Convenția de la Istanbul Moldova ratificare Maia Sandu familii",
    "Стамбульская конвенция Молдова Санду нетрадиционные семьи",
    "Istanbul Convention Moldova Sandu ratification families",
  ],
  "control-ratification": [
    "Parlamentul Moldovei ratificat Convenția de la Istanbul octombrie 2021",
    "парламент Молдовы ратификация Стамбульской конвенции октябрь 2021",
    "Moldova parliament ratified Istanbul Convention October 2021",
  ],
  "control-sandu-speech": [
    "Maia Sandu Kremlinul sute de milioane de euro voturi",
    "Санду Кремль сотни миллионов евро покупка голосов",
    "Sandu Kremlin hundreds of millions euros buy votes",
  ],
};

/** Точные слова истории на всех языках: копия без них — не про этот случай */
const ANCHORS: Record<string, RegExp> = {
  "migrants-300k": /osmochescu|осмокеску|осмошеск/i,
  "dereneu-church": /dereneu|деренеу/i,
  "transnistria-mines":
    /(заминир|минир|mined|mining|minat|mine\b|mines\b).{0,160}(приднестр|transnistr)|(приднестр|transnistr).{0,160}(заминир|минир|mined|mining|minat|mine\b|mines\b)/is,
  "usaid-sandu": /usaid/i,
  "gas-blocked": /(газ|gaz|gas).{0,200}(приднестр|transnistr)/is,
  "nato-70k": /70[ .,]?(000|тыс|de mii|mii|thousand)/i,
  "soros-lgbt": /(soros|сорос).{0,300}(lgbt|лгбт)|(lgbt|лгбт).{0,300}(soros|сорос)/is,
  "sandu-sperm": /(sperm|сперм)/i,
  "istanbul-convention":
    /(istanbul|стамбульск).{0,300}(moldov|молдов)|(moldov|молдов).{0,300}(istanbul|стамбульск)/is,
  "control-ratification":
    /(ratif|ратифик).{0,300}(istanbul|стамбульск)|(istanbul|стамбульск).{0,300}(ratif|ратифик)/is,
  "control-sandu-speech": /(sandu|санду).{0,300}(milioane|миллион|million)/is,
};

function claimOf(c: PipelineCase): Claim {
  return {
    id: `clm_${c.id}`,
    jobId: "eval",
    range: { start: 0, end: 0 },
    quote: c.text,
    normalized: c.text,
    category: "event",
    checkworthiness: 0.9,
    language: c.language,
    entities: c.gold.keywords,
    segmentIds: [],
  };
}

function planned(c: PipelineCase): PlannedQuery[] {
  const [ro, ru, en] = QUERIES[c.id]!;
  const all = [
    { text: ro, language: "ro" },
    { text: ru, language: "ru" },
    { text: en, language: "en" },
  ];
  // свой язык первым: как обычно отвечает LLM, а прежний режим ищет ранние только по первому запросу
  const own = all.filter((q) => q.language === c.language);
  return [...own, ...all.filter((q) => q.language !== c.language)].map((q) => ({
    ...q,
    intent: "confirm",
    freshness: "any",
  }));
}

function metrics(c: PipelineCase, result: CopiesResult) {
  const { copies, traces } = result;
  const window = c.gold.rootWindow;
  const days = copies.map((x) => x.publishedAt?.slice(0, 10)).filter((d): d is string => !!d);
  const anchored = copies.filter((x) => ANCHORS[c.id]!.test(`${x.title} ${x.excerpt}`));
  const anchoredDays = anchored
    .map((x) => x.publishedAt?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();
  const hosts = new Set(copies.map((x) => x.domain.replace(/^www\./, "")));
  return {
    copies: copies.length,
    dated: days.length,
    domains: hosts.size,
    languages: [...new Set(copies.map((x) => x.language))].join(","),
    earliest: [...days].sort()[0] ?? null,
    anchored: anchored.length,
    earliestAnchored: anchoredDays[0] ?? null,
    anchoredShare: copies.length ? Math.round((anchored.length / copies.length) * 100) : 0,
    inWindow: window ? days.filter((d) => d >= window.from && d <= window.to).length : null,
    expected: c.gold.expectDomains.filter((d) => [...hosts].some((h) => h === d || h.endsWith(`.${d}`))),
    traced: copies.filter((x) => x.traced).length,
    links: copies.reduce((n, x) => n + x.outboundLinks.length, 0),
    rounds: traces?.rounds ?? null,
    stopped: traces?.stopped ?? null,
    traces: traces?.traces.length ?? null,
    tracesFound: traces?.traces.filter((t) => t.status === "found").length ?? null,
    outOfBudget: traces?.traces.filter((t) => t.status === "out_of_budget").length ?? null,
  };
}

mkdirSync(OUT, { recursive: true });
const rows: unknown[] = [];
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt >= 0 ? (process.argv[onlyAt + 1] ?? "").split(",") : [];
const queue = CASES.filter((c) => !only.length || only.some((part) => c.id.includes(part)));
await Promise.all(
  [0, 1, 2].map(async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const ctx: StageContext = {
        jobId: "eval",
        signal: new AbortController().signal,
        log: (msg) => console.log(`[${c!.id}] ${msg}`),
      };
      const before = await findCopiesWithTraces(claimOf(c), planned(c), ctx, false);
      const after = await findCopiesWithTraces(claimOf(c), planned(c), ctx, true);
      const row = {
        id: c.id,
        window: c.gold.rootWindow,
        before: metrics(c, before),
        after: metrics(c, after),
      };
      rows.push(row);
      writeFileSync(
        `${OUT}${c.id}.json`,
        JSON.stringify({ ...row, beforeRaw: before, afterRaw: after }, null, 2),
      );
      console.error("готово", c.id);
    }
  }),
);
writeFileSync(`${OUT}summary${only.length ? "-partial" : ""}.json`, JSON.stringify(rows, null, 2));
