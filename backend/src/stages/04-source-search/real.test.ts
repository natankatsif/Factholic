/**
 * Этап 04 целиком, без сети: globalThis.fetch подменён фейками OpenAI Responses API, Tavily и Google Fact Check.
 * Ключи/провайдеры — мутацией config.providers. OpenAI-клиент кешируется в llm.ts вместе с fetch,
 * поэтому фейк ставится один раз на файл и только переключает обработчики.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import { LlmConfigError } from "./llm.ts";
import { mockSourceSearchInput } from "./mock.ts";
import { planQueries } from "./queries.ts";
import { searchSourcesReal } from "./real.ts";
import type { SourceSearchInput } from "./types.ts";

// ---------- фейковые внешние API ----------

interface LlmRequest {
  model: string;
  instructions: string;
  input: string;
  reasoning?: { effort?: string };
}

interface Captured {
  url: URL;
  headers: Headers;
  body: Record<string, unknown>;
}

interface RawQuery {
  text: string;
  language: string;
  intent: "confirm" | "refute" | "context";
  freshness: "any" | "year" | "month";
}

interface TavilyPage {
  url: string;
  title: string;
  score: number;
  raw_content: string;
  published_date?: string;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function llmJson(data: unknown): Response {
  return json({
    id: "resp_test",
    object: "response",
    created_at: 0,
    status: "completed",
    model: "gpt-6.1-sol",
    output: [
      {
        type: "message",
        id: "msg_1",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(data), annotations: [] }],
      },
    ],
    incomplete_details: null,
    error: null,
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  });
}

const llmQueries = (queries: RawQuery[]) => llmJson({ queries });

function httpError(status: number): Response {
  // retry-after-ms — чтобы ретраи OpenAI SDK на 429/5xx не ждали секундами
  return json(
    { error: { message: `fake ${status}`, type: "fake", param: null, code: null } },
    {
      status,
      headers: { "retry-after-ms": "1" },
    },
  );
}

const page = (...paragraphs: string[]) => paragraphs.join("\n\n");

const PAGES: Record<string, TavilyPage[]> = {
  "война в Украине": [
    {
      url: "https://www.dw.com/ru/vojna-v-ukraine/a-1",
      title: "Война в Украине: главное за сутки – DW",
      score: 0.84,
      raw_content: page(
        "Боевые действия в Украине продолжаются на нескольких направлениях, сообщают военные обеих сторон. Война идёт с февраля 2022 года.",
        "Подписывайтесь на наш канал.",
      ),
    },
    {
      url: "https://zz-recipes.example.com/borscht",
      title: "Лучший рецепт борща — Кулинарный блог",
      score: 0.4,
      raw_content: "Свёклу натереть на крупной тёрке, обжарить с морковью и луком минут десять.",
    },
    {
      url: "https://zz-kyiv-news.com.ua/war-today",
      title: "Война в Украине сегодня - Kyiv News",
      score: 0.7,
      raw_content:
        "Война в Украине продолжается: бои идут на нескольких направлениях фронта, сообщает Генштаб.",
    },
  ],
  "war in Ukraine latest": [
    {
      url: "https://www.ohchr.org/en/countries/ukraine?utm_source=x",
      title: "Ukraine | OHCHR",
      score: 0.91,
      raw_content: page(
        "Skip to main content",
        "The UN Human Rights Monitoring Mission in Ukraine continues to document civilian casualties resulting from the war in Ukraine, which escalated in February 2022.",
      ),
    },
    {
      url: "https://www.reuters.com/world/europe/ukraine-war-latest/",
      title: "Ukraine war latest: fighting continues | Reuters",
      score: 0.88,
      published_date: "Thu, 02 Oct 2026 08:00:00 GMT",
      raw_content:
        "Fighting continued along the front line in Ukraine overnight, officials said. The war has been going on since February 2022.",
    },
    {
      // та же страница другим URL — должна схлопнуться
      url: "https://reuters.com/world/europe/ukraine-war-latest",
      title: "Ukraine war latest (дубль)",
      score: 0.5,
      raw_content: "Fighting continued in Ukraine war, latest reports say so.",
    },
  ],
  "Ukraine war fact check": [
    {
      url: "https://zz-factcheck.org/ukraine-war",
      title: "Fact check: is the war in Ukraine over? - ZZ Check",
      score: 0.6,
      raw_content:
        "Fact check: claims that the war in Ukraine ended are false; fighting continues, reports show.",
    },
  ],
};

const LLM_QUERIES: RawQuery[] = [
  { text: "война в Украине", language: "ru", intent: "confirm", freshness: "month" },
  { text: "  war in Ukraine latest ", language: "EN", intent: "confirm", freshness: "month" },
  { text: "Ukraine war fact check", language: "en", intent: "refute", freshness: "any" },
  { text: "   ", language: "en", intent: "context", freshness: "any" },
];

let respondLlm: (req: LlmRequest) => Response;
let respondTavily: (req: Captured) => Response;
let respondFactCheck: (req: Captured) => Response;
let llmRequests: LlmRequest[];
let tavilyRequests: Captured[];
/** Запросы за sources; у запросов copies include_raw_content = "markdown" (нужны ссылки) */
const sourceRequests = () => tavilyRequests.filter((r) => r.body.include_raw_content !== "markdown");
const copyRequests = () => tavilyRequests.filter((r) => r.body.include_raw_content === "markdown");
let factCheckRequests: Captured[];

const realFetch = globalThis.fetch;
const llmConfig = config.providers.llm as { provider: string; apiKey: string; model: string };
const searchConfig = config.providers.search as { provider: string; apiKey: string };
const factCheckConfig = config.providers.factCheck as { apiKey: string };
const saved = { llm: { ...llmConfig }, search: { ...searchConfig }, factCheck: { ...factCheckConfig } };

before(() => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (url.pathname.endsWith("/responses")) {
      llmRequests.push(body as unknown as LlmRequest);
      return respondLlm(body as unknown as LlmRequest);
    }
    if (url.origin === "https://api.tavily.com") {
      tavilyRequests.push({ url, headers, body });
      return respondTavily({ url, headers, body });
    }
    if (url.origin === "https://factchecktools.googleapis.com") {
      factCheckRequests.push({ url, headers, body });
      return respondFactCheck({ url, headers, body });
    }
    throw new Error(`Неожиданный сетевой запрос в тесте: ${url.href}`);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  Object.assign(llmConfig, saved.llm);
  Object.assign(searchConfig, saved.search);
  Object.assign(factCheckConfig, saved.factCheck);
});

beforeEach(() => {
  Object.assign(llmConfig, { provider: "openai", apiKey: "sk-test", model: "gpt-6.1-sol" });
  Object.assign(searchConfig, { provider: "tavily", apiKey: "tvly-test-key" });
  factCheckConfig.apiKey = "";
  llmRequests = [];
  tavilyRequests = [];
  factCheckRequests = [];
  respondLlm = () => llmQueries(LLM_QUERIES);
  respondTavily = (req) => json({ results: PAGES[String(req.body.query)] ?? [] });
  respondFactCheck = () => json({});
  logs = [];
});

let logs: string[] = [];
function makeCtx(signal: AbortSignal = new AbortController().signal): StageContext {
  return {
    jobId: "job_test",
    signal,
    log: (msg, data) => logs.push(`${msg} ${data === undefined ? "" : String(data)}`),
  };
}

const input: SourceSearchInput = { ...mockSourceSearchInput, maxSources: 5 };

// ---------- planQueries ----------

describe("planQueries", () => {
  it("запрос к LLM: модель из config, effort low, тезис, цитата и языки поиска", async () => {
    llmConfig.model = "gpt-test-model";
    await planQueries(input, makeCtx());
    assert.equal(llmRequests.length, 1);
    const [req] = llmRequests;
    assert.equal(req.model, "gpt-test-model");
    assert.equal(req.reasoning?.effort, "low");
    assert.match(req.instructions, /поисковые запросы/);
    assert.ok(req.input.includes(`Утверждение: ${mockClaim.normalized}`));
    assert.ok(req.input.includes(`«${mockClaim.quote}»`));
    assert.ok(req.input.includes("Языки поиска: ru, en"));
  });

  it("ответ LLM нормализуется: пробелы обрезаны, язык — две буквы в нижнем регистре, пустые выброшены", async () => {
    assert.deepEqual(await planQueries(input, makeCtx()), [
      { text: "война в Украине", language: "ru", intent: "confirm", freshness: "month" },
      { text: "war in Ukraine latest", language: "en", intent: "confirm", freshness: "month" },
      { text: "Ukraine war fact check", language: "en", intent: "refute", freshness: "any" },
    ]);
  });

  it("язык не в виде двухбуквенного кода (German, пусто) → язык тезиса", async () => {
    respondLlm = () =>
      llmQueries([
        { text: "Krieg in der Ukraine", language: "German", intent: "confirm", freshness: "any" },
        { text: "война Украина", language: "", intent: "context", freshness: "any" },
      ]);
    assert.deepEqual(
      (await planQueries(input, makeCtx())).map((q) => q.language),
      ["ru", "ru"],
    );
  });

  it("не больше 5 запросов", async () => {
    respondLlm = () =>
      llmQueries(
        Array.from({ length: 8 }, (_, i) => ({
          text: `запрос ${i}`,
          language: "ru",
          intent: "confirm",
          freshness: "any",
        })),
      );
    assert.equal((await planQueries(input, makeCtx())).length, 5);
  });

  const FALLBACK = [
    { text: "На территории Украины идёт война.", language: "ru", intent: "confirm", freshness: "month" },
    { text: "Украина", language: "en", intent: "context", freshness: "month" },
    { text: "Украина fact check", language: "en", intent: "refute", freshness: "month" },
  ];

  it("ошибка настройки LLM (нет ключа, чужой провайдер) → LlmConfigError, не маскируется простыми запросами", async () => {
    llmConfig.apiKey = "";
    await assert.rejects(planQueries(input, makeCtx()), LlmConfigError);
    llmConfig.apiKey = "sk-test";
    llmConfig.provider = "anthropic";
    await assert.rejects(planQueries(input, makeCtx()), LlmConfigError);
    assert.equal(llmRequests.length, 0);
  });

  it("временный сбой LLM → простые запросы", async () => {
    respondLlm = () => httpError(500);
    assert.deepEqual(await planQueries(input, makeCtx()), FALLBACK);
    assert.ok(logs.some((l) => l.includes("беру простые")));
  });

  it("LLM вернула пустой список → простые запросы", async () => {
    respondLlm = () => llmQueries([]);
    assert.deepEqual(await planQueries(input, makeCtx()), FALLBACK);
  });

  it("простые запросы: не событие → freshness any; без сущностей → «fact check» к самому тезису", async () => {
    respondLlm = () => httpError(500);
    const claim = {
      ...mockClaim,
      category: "statistic" as const,
      entities: [],
      normalized: "ВВП вырос на 3%.",
    };
    assert.deepEqual(await planQueries({ ...input, claim }, makeCtx()), [
      { text: "ВВП вырос на 3%.", language: "ru", intent: "confirm", freshness: "any" },
      { text: "ВВП вырос на 3%. fact check", language: "en", intent: "refute", freshness: "any" },
    ]);
  });

  it("отмена (signal aborted) → исключение, а не простые запросы", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(planQueries(input, makeCtx(controller.signal)));
  });
});

// ---------- searchSourcesReal ----------

describe("searchSourcesReal", () => {
  it("находит, чистит и отбирает источники: дубли схлопнуты, не по теме отсеяно, ids по тезису", async () => {
    const out = await searchSourcesReal(input, makeCtx());
    assert.equal(out.claimId, mockClaim.id);
    assert.deepEqual(out.queries, [
      { text: "война в Украине", language: "ru", engine: "tavily" },
      { text: "war in Ukraine latest", language: "en", engine: "tavily" },
      { text: "Ukraine war fact check", language: "en", engine: "tavily" },
    ]);

    const domains = out.sources.map((s) => s.domain);
    assert.deepEqual(
      new Set(domains),
      new Set(["dw.com", "zz-kyiv-news.com.ua", "ohchr.org", "reuters.com", "zz-factcheck.org"]),
    );
    assert.equal(domains.length, 5, "reuters.com — один раз, рецепт борща отсеян");
    assert.equal(new Set(out.sources.map((s) => s.publisher)).size, out.sources.length);
    assert.deepEqual(
      out.sources.map((s) => s.id),
      ["clm_05_s1", "clm_05_s2", "clm_05_s3", "clm_05_s4", "clm_05_s5"],
    );

    const byDomain = Object.fromEntries(out.sources.map((s) => [s.domain, s]));
    assert.equal(
      byDomain["reuters.com"].title,
      "Ukraine war latest: fighting continues | Reuters",
      "из дублей — лучший",
    );
    assert.equal(byDomain["reuters.com"].publishedAt, "2026-10-02T08:00:00.000Z");
    assert.equal(byDomain["reuters.com"].language, "en");
    assert.equal(byDomain["dw.com"].language, "ru");
    assert.equal(byDomain["zz-kyiv-news.com.ua"].publisher, "Kyiv News");
    assert.equal(byDomain["zz-kyiv-news.com.ua"].country, "UA");
    for (const s of out.sources) {
      assert.ok(s.excerpt.length > 0 && s.snippet.length > 0, s.domain);
      assert.ok(s.domainReliability > 0 && s.domainReliability <= 1, s.domain);
      assert.equal(s.retrievedAt, out.sources[0].retrievedAt);
      assert.ok(!Number.isNaN(Date.parse(s.retrievedAt)));
    }
  });

  it("возвращает не больше maxSources", async () => {
    const out = await searchSourcesReal({ ...input, maxSources: 2 }, makeCtx());
    assert.equal(out.sources.length, 2);
  });

  it("в Tavily уходят ключ в Authorization и exclude_domains с соцсетями и видеохостингами", async () => {
    await searchSourcesReal(input, makeCtx());
    // 3 запроса за sources (+ запросы copies — их проверяют тесты ниже)
    assert.equal(sourceRequests().length, 3);
    // соцсети исключаем только из sources: для copies пост в соцсети может оказаться первоисточником
    for (const req of tavilyRequests) assert.equal(req.headers.get("authorization"), "Bearer tvly-test-key");
    for (const req of sourceRequests()) {
      assert.equal(req.headers.get("authorization"), "Bearer tvly-test-key");
      const excluded = req.body.exclude_domains as string[];
      assert.ok(Array.isArray(excluded));
      for (const domain of ["youtube.com", "tiktok.com", "facebook.com", "x.com"]) {
        assert.ok(excluded.includes(domain), domain);
      }
    }
  });

  it("ошибка настройки LLM → исключение до поиска (тезис будет failed)", async () => {
    llmConfig.apiKey = "";
    await assert.rejects(searchSourcesReal(input, makeCtx()), LlmConfigError);
    assert.equal(tavilyRequests.length, 0);
  });

  it("временный сбой LLM → поиск по простым запросам", async () => {
    respondLlm = () => httpError(503);
    const out = await searchSourcesReal(input, makeCtx());
    assert.ok(llmRequests.length >= 1);
    assert.deepEqual(out.queries, [
      { text: "На территории Украины идёт война.", language: "ru", engine: "tavily" },
      { text: "Украина", language: "en", engine: "tavily" },
      { text: "Украина fact check", language: "en", engine: "tavily" },
    ]);
    assert.deepEqual(
      sourceRequests().map((r) => r.body.query),
      out.queries.map((q) => q.text),
    );
  });

  it("частичное падение поиска не валит этап", async () => {
    respondTavily = (req) =>
      req.body.query === "Ukraine war fact check"
        ? new Response("rate limited", { status: 429 })
        : json({ results: PAGES[String(req.body.query)] ?? [] });
    const out = await searchSourcesReal(input, makeCtx());
    assert.equal(out.sources.length, 4);
    assert.ok(!out.sources.some((s) => s.domain === "zz-factcheck.org"));
    assert.ok(logs.some((l) => l.includes("поисковый запрос упал") && l.includes("429")));
  });

  it("упали все поисковые запросы → исключение (оркестратор пометит тезис failed)", async () => {
    factCheckConfig.apiKey = "g-test-key";
    respondTavily = () => new Response("boom", { status: 500 });
    respondFactCheck = () => new Response("boom", { status: 500 });
    await assert.rejects(searchSourcesReal(input, makeCtx()), /все поисковые запросы упали/);
  });

  it("ничего не нашли → sources: [] без исключения", async () => {
    respondTavily = () => json({ results: [] });
    const out = await searchSourcesReal(input, makeCtx());
    assert.deepEqual(out.sources, []);
    assert.equal(out.queries.length, 3);
  });

  it("всё найденное не по теме → sources: []", async () => {
    respondTavily = () => json({ results: [PAGES["война в Украине"][1]] });
    assert.deepEqual((await searchSourcesReal(input, makeCtx())).sources, []);
  });

  it("Fact Check API: ключ только в заголовке x-goog-api-key, по запросу на язык, разбор попадает в источники", async () => {
    factCheckConfig.apiKey = "g-secret-key";
    respondFactCheck = (req) =>
      req.url.searchParams.get("languageCode") === "en"
        ? json({
            claims: [
              {
                text: "The war in Ukraine ended in 2024",
                claimant: "social media",
                claimReview: [
                  {
                    publisher: { name: "AFP Fact Check", site: "factcheck.afp.com" },
                    url: "https://factcheck.afp.com/doc.afp.com.123",
                    title: "No, the war in Ukraine has not ended",
                    textualRating: "False",
                    languageCode: "en",
                  },
                ],
              },
            ],
          })
        : json({});
    const out = await searchSourcesReal({ ...input, maxSources: 6 }, makeCtx());

    assert.equal(factCheckRequests.length, 2);
    for (const req of factCheckRequests) {
      assert.equal(req.headers.get("x-goog-api-key"), "g-secret-key");
      assert.ok(!req.url.href.includes("g-secret-key"), req.url.href);
    }
    assert.deepEqual(
      out.queries.filter((q) => q.engine === "factcheck_api"),
      [
        { text: "война в Украине", language: "ru", engine: "factcheck_api" },
        { text: "war in Ukraine latest", language: "en", engine: "factcheck_api" },
      ],
    );
    const afp = out.sources.find((s) => s.domain === "factcheck.afp.com");
    assert.ok(afp, "разбор фактчекера должен попасть в источники");
    assert.equal(afp.sourceType, "fact_checker");
    assert.equal(afp.publisher, "AFP Fact Check");
    assert.equal(afp.snippet, "False: No, the war in Ukraine has not ended");
  });

  it("без ключа Fact Check API к нему не обращаемся", async () => {
    const out = await searchSourcesReal(input, makeCtx());
    assert.equal(factCheckRequests.length, 0);
    assert.ok(!out.queries.some((q) => q.engine === "factcheck_api"));
  });

  it("неподдерживаемый поисковый провайдер → исключение до любых запросов", async () => {
    searchConfig.provider = "brave";
    await assert.rejects(searchSourcesReal(input, makeCtx()), /SEARCH_PROVIDER="brave"/);
    assert.equal(llmRequests.length + tavilyRequests.length + factCheckRequests.length, 0);
  });

  it("отмена (signal aborted) → исключение", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(searchSourcesReal(input, makeCtx(controller.signal)));
  });
});

describe("searchSourcesReal: copies (все перепечатки для дерева)", () => {
  const COPY_PAGES = [
    {
      url: "https://zz-novosti.md/2023/03/14/voina-v-ukraine",
      title: "Война в Украине: главное — Новости MD",
      score: 0.8,
      raw_content:
        "Война в Украине продолжается, по данным Генштаба ВСУ, бои идут на востоке. Источник: [Генштаб](https://zz-genshtab.gov.ua/news/123). [Поделиться](https://facebook.com/sharer/sharer.php?u=x)",
    },
    {
      // тот же издатель второй раз — для дерева нужна каждая копия
      url: "https://zz-novosti.md/ru/drugaya-statya-pro-voinu-v-ukraine",
      title: "Ещё о войне в Украине — Новости MD",
      score: 0.6,
      published_date: "Wed, 01 Oct 2025 10:00:00 GMT",
      raw_content: "Война в Украине: как сообщает Reuters, бои не прекращаются уже несколько лет.",
    },
  ];
  const EARLIEST_PAGE = {
    url: "https://zz-pervyi.md/news/voina-v-ukraine-nachalas",
    title: "Война в Украине началась — Первый",
    score: 0.5,
    published_date: "Thu, 24 Feb 2022 05:00:00 GMT",
    raw_content: "Война в Украине началась сегодня утром, заявил президент Украины.",
  };

  beforeEach(() => {
    respondTavily = (req) => {
      if (req.body.include_raw_content !== "markdown")
        return json({ results: PAGES[String(req.body.query)] ?? [] });
      return json({ results: req.body.end_date ? [EARLIEST_PAGE] : COPY_PAGES });
    };
  });

  it("запросы копий: markdown, без ограничения свежести, без запроса-опровержения, Молдова для ru", async () => {
    await searchSourcesReal(input, makeCtx());
    const round1 = copyRequests().filter((r) => !r.body.end_date);
    assert.deepEqual(
      round1.map((r) => r.body.query),
      ["война в Украине", "war in Ukraine latest"],
    );
    for (const r of round1) assert.equal(r.body.time_range, undefined);
    assert.equal(round1[0]!.body.country, "moldova");
    assert.equal(round1[1]!.body.country, undefined);
  });

  it("второй раунд ищет то, что раньше самой старой найденной копии", async () => {
    await searchSourcesReal(input, makeCtx());
    const earliest = copyRequests().filter((r) => r.body.end_date);
    assert.equal(earliest.length, 1);
    // самая старая копия первого раунда — 14.03.2023 (из адреса) → ищем до 13.03.2023
    assert.equal(earliest[0]!.body.end_date, "2023-03-13");
  });

  it("копии: перепечатки одного издателя не отсеиваются, сортировка по дате, даты, ссылки, «по данным»", async () => {
    const out = await searchSourcesReal(input, makeCtx());
    const copies = out.copies ?? [];
    assert.deepEqual(
      copies.map((c) => [c.url, c.publishedAt?.slice(0, 10), c.dateSource, c.earliestSearch]),
      [
        [EARLIEST_PAGE.url, "2022-02-24", "search", true],
        [COPY_PAGES[0]!.url, "2023-03-14", "url", false],
        [COPY_PAGES[1]!.url, "2025-10-01", "search", false],
      ],
    );
    assert.deepEqual(copies[1]!.outboundLinks, ["https://zz-genshtab.gov.ua/news/123"]);
    assert.ok(copies[1]!.attributions.some((a) => a.startsWith("по данным Генштаба")));
    assert.ok(copies[2]!.attributions.some((a) => a.startsWith("как сообщает Reuters")));
    assert.deepEqual(
      copies.map((c) => c.id),
      [`${input.claim.id}_c1`, `${input.claim.id}_c2`, `${input.claim.id}_c3`],
    );
  });

  it("поиск копий упал — sources всё равно возвращаются", async () => {
    respondTavily = (req) =>
      req.body.include_raw_content === "markdown"
        ? httpError(500)
        : json({ results: PAGES[String(req.body.query)] ?? [] });
    const out = await searchSourcesReal(input, makeCtx());
    assert.ok(out.sources.length > 0);
    assert.deepEqual(out.copies, []);
  });
});
