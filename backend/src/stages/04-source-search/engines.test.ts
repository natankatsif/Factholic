import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { config } from "../../config.ts";
import { factCheckSearch, limited, tavilySearch } from "./engines.ts";
import type { PlannedQuery } from "./queries.ts";

// ---------- limited ----------

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Даём отработать микрозадачам (передаче слотов в finally) */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("limited", () => {
  it("не больше 6 задач одновременно, остальные ждут и запускаются по очереди", async () => {
    let running = 0;
    let maxRunning = 0;
    const started: number[] = [];
    const gates = Array.from({ length: 15 }, () => deferred());
    const all = Promise.all(
      gates.map((gate, i) =>
        limited(async () => {
          started.push(i);
          running++;
          maxRunning = Math.max(maxRunning, running);
          await gate.promise;
          running--;
          return i * 10;
        }),
      ),
    );

    await flush();
    assert.deepEqual(started, [0, 1, 2, 3, 4, 5]);

    gates[2].resolve();
    await flush();
    assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6], "освободился один слот — стартовала ровно одна задача");

    for (const gate of gates) gate.resolve();
    assert.deepEqual(
      await all,
      gates.map((_, i) => i * 10),
    );
    assert.equal(maxRunning, 6);
  });

  it("упавшая задача освобождает слот, ошибка доходит до вызывающего", async () => {
    const gates = Array.from({ length: 6 }, () => deferred());
    const failing = gates.map((gate) =>
      limited(async () => {
        await gate.promise;
        throw new Error("поиск упал");
      }),
    );
    let seventhStarted = false;
    const seventh = limited(async () => {
      seventhStarted = true;
      return "ok";
    });

    await flush();
    assert.equal(seventhStarted, false);
    for (const gate of gates) gate.resolve();
    for (const p of failing) await assert.rejects(p, /поиск упал/);
    assert.equal(await seventh, "ok");
  });

  it("синхронное исключение внутри задачи тоже освобождает слот", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        limited((() => {
          throw new Error("sync");
        }) as () => Promise<never>),
      ),
    );
    assert.ok(results.every((r) => r.status === "rejected"));
  });

  it("после завершения всех задач снова доступны все 6 слотов", async () => {
    const gates = Array.from({ length: 7 }, () => deferred());
    let started = 0;
    const tasks = gates.map((gate) =>
      limited(async () => {
        started++;
        await gate.promise;
      }),
    );
    await flush();
    assert.equal(started, 6);
    for (const gate of gates) gate.resolve();
    await Promise.all(tasks);
  });
});

// ---------- поисковые движки: запрос и разбор ответа ----------

interface Captured {
  url: URL;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | undefined;
}

let captured: Captured[] = [];
let respond: (req: Captured) => Response = () => new Response("не задано", { status: 500 });

const realFetch = globalThis.fetch;
const searchConfig = config.providers.search as { provider: string; apiKey: string };
const factCheckConfig = config.providers.factCheck as { apiKey: string };
const saved = { search: { ...searchConfig }, factCheck: { ...factCheckConfig } };

before(() => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const req: Captured = {
      url: new URL(input instanceof Request ? input.url : String(input)),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    };
    captured.push(req);
    return respond(req);
  }) as typeof fetch;
  searchConfig.provider = "tavily";
  searchConfig.apiKey = "tvly-test-key";
  factCheckConfig.apiKey = "g-test-key";
});

after(() => {
  globalThis.fetch = realFetch;
  Object.assign(searchConfig, saved.search);
  Object.assign(factCheckConfig, saved.factCheck);
});

afterEach(() => {
  captured = [];
  respond = () => new Response("не задано", { status: 500 });
});

const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const signal = new AbortController().signal;

const query = (over: Partial<PlannedQuery> = {}): PlannedQuery => ({
  text: "война в Украине",
  language: "ru",
  intent: "confirm",
  freshness: "any",
  ...over,
});

describe("tavilySearch", () => {
  it("POST с ключом в Authorization, advanced-поиском, текстом страниц и исключёнными соцсетями", async () => {
    respond = () => json({ results: [] });
    await tavilySearch(query(), signal);
    assert.equal(captured.length, 1);
    const [req] = captured;
    assert.equal(req.url.href, "https://api.tavily.com/search");
    assert.equal(req.method, "POST");
    assert.equal(req.headers.get("authorization"), "Bearer tvly-test-key");
    assert.equal(req.body?.query, "война в Украине");
    assert.equal(req.body?.search_depth, "advanced");
    assert.equal(req.body?.include_raw_content, "text");
    const excluded = req.body?.exclude_domains as string[];
    for (const domain of ["youtube.com", "tiktok.com", "facebook.com", "x.com", "reddit.com", "t.me"]) {
      assert.ok(excluded.includes(domain), domain);
    }
  });

  it("freshness → topic и time_range", async () => {
    respond = () => json({ results: [] });
    await tavilySearch(query({ freshness: "month" }), signal);
    await tavilySearch(query({ freshness: "year" }), signal);
    await tavilySearch(query({ freshness: "any" }), signal);
    assert.deepEqual(
      captured.map((r) => [r.body?.topic, r.body?.time_range]),
      [
        ["news", "month"],
        ["general", "year"],
        ["general", undefined],
      ],
    );
  });

  it("результаты → кандидаты: текст страницы (или content), релевантность, язык и запрос", async () => {
    respond = () =>
      json({
        results: [
          {
            title: "Ukraine war latest",
            url: "https://reuters.com/a",
            content: "кусок",
            raw_content: "полный текст",
            score: 0.9,
            published_date: "2026-10-02",
          },
          {
            title: "Без текста",
            url: "https://dw.com/b",
            content: "только content",
            raw_content: null,
            score: 0.4,
          },
          {
            title: "Пустой текст",
            url: "https://dw.com/c",
            content: "снова content",
            raw_content: "",
            score: 0.3,
          },
        ],
      });
    const candidates = await tavilySearch(query({ intent: "refute", freshness: "month" }), signal);
    assert.deepEqual(candidates[0], {
      url: "https://reuters.com/a",
      title: "Ukraine war latest",
      text: "полный текст",
      publishedAt: "2026-10-02",
      relevance: 0.9,
      language: "ru",
      queries: [{ text: "война в Украине", intent: "refute" }],
      fallbackType: "news",
    });
    assert.equal(candidates[1].text, "только content");
    assert.equal(candidates[2].text, "снова content");
  });

  it("не свежий запрос → тип по умолчанию other; нет results → пусто", async () => {
    respond = () => json({ results: [{ title: "t", url: "https://x.com/1", content: "c", score: 0.5 }] });
    assert.equal((await tavilySearch(query({ freshness: "year" }), signal))[0].fallbackType, "other");
    respond = () => json({});
    assert.deepEqual(await tavilySearch(query(), signal), []);
  });

  it("ответ не 2xx → исключение со статусом", async () => {
    respond = () => new Response("rate limited", { status: 429 });
    await assert.rejects(tavilySearch(query(), signal), /Tavily 429: rate limited/);
  });
});

describe("factCheckSearch", () => {
  const review = {
    publisher: { name: "AFP Fact Check", site: "factcheck.afp.com" },
    url: "https://factcheck.afp.com/doc.1",
    title: "Нет, война не закончилась",
    reviewDate: "2026-09-01T00:00:00Z",
    textualRating: "Ложь",
    languageCode: "ru",
  };

  it("ключ уходит в заголовке x-goog-api-key, а не в URL; параметры поиска в query string", async () => {
    respond = () => json({});
    await factCheckSearch(query(), signal);
    const [req] = captured;
    assert.equal(
      req.url.origin + req.url.pathname,
      "https://factchecktools.googleapis.com/v1alpha1/claims:search",
    );
    assert.equal(req.headers.get("x-goog-api-key"), "g-test-key");
    assert.ok(!req.url.href.includes("g-test-key"));
    assert.equal(req.url.searchParams.get("key"), null);
    assert.equal(req.url.searchParams.get("query"), "война в Украине");
    assert.equal(req.url.searchParams.get("languageCode"), "ru");
    assert.equal(req.url.searchParams.get("pageSize"), "5");
  });

  it("разбор → кандидат фактчекера с готовыми excerpt/snippet и издателем", async () => {
    respond = () =>
      json({ claims: [{ text: "Война закончилась", claimant: "соцсети", claimReview: [review] }] });
    const [c] = await factCheckSearch(query({ language: "en" }), signal);
    assert.equal(c.url, review.url);
    assert.equal(c.title, review.title);
    assert.equal(c.fallbackType, "fact_checker");
    assert.equal(c.language, "ru", "язык разбора важнее языка запроса");
    assert.deepEqual(c.queries, [{ text: "война в Украине", intent: "refute" }]);
    assert.equal(c.preset?.publisher, "AFP Fact Check");
    assert.equal(c.preset?.snippet, "Ложь: Нет, война не закончилась");
    assert.equal(
      c.preset?.excerpt,
      "Проверяемое утверждение: «Война закончилась» (соцсети). AFP Fact Check: Ложь. Нет, война не закончилась",
    );
    assert.equal(c.text, c.preset?.excerpt);
  });

  it("релевантность падает с позицией в выдаче, но не ниже 0.4; разборы без url пропускаются", async () => {
    respond = () =>
      json({
        claims: Array.from({ length: 6 }, (_, i) => ({
          text: `утверждение ${i}`,
          claimReview: [
            { ...review, url: `https://zz-check.org/${i}` },
            { ...review, url: undefined },
          ],
        })),
      });
    const candidates = await factCheckSearch(query(), signal);
    assert.equal(candidates.length, 6);
    assert.deepEqual(
      candidates.map((c) => Math.round(c.relevance * 10) / 10),
      [0.8, 0.7, 0.6, 0.5, 0.4, 0.4],
    );
  });

  it("без издателя и языка: «Фактчекер», язык запроса, заголовок из текста утверждения", async () => {
    respond = () =>
      json({
        claims: [
          { text: "Утверждение", claimReview: [{ url: "https://zz-check.org/1", textualRating: "Ложь" }] },
        ],
      });
    const [c] = await factCheckSearch(query(), signal);
    assert.equal(c.language, "ru");
    assert.equal(c.title, "Утверждение");
    assert.equal(c.preset?.publisher, undefined);
    assert.ok(c.preset?.excerpt.includes("Фактчекер: Ложь."));
  });

  it("ответ не 2xx → исключение со статусом", async () => {
    respond = () => new Response("forbidden", { status: 403 });
    await assert.rejects(factCheckSearch(query(), signal), /Fact Check API 403/);
  });
});
