/**
 * Этап 05 целиком, без сети: globalThis.fetch подменён фейками OpenAI Responses API и Embeddings API,
 * ключ/провайдер/модель подставляются мутацией config.providers.llm.
 * OpenAI-клиент кешируется в llm.ts при первом вызове вместе с fetch, поэтому фейк ставится один раз на файл
 * и только переключает обработчики.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import type { SourceCopy } from "../04-source-search/types.ts";
import { LlmConfigError } from "./llm.ts";
import { buildProvenanceTreeReal } from "./real.ts";
import { VIDEO_NODE_ID, type ProvenanceInput, type ProvenanceTree } from "./types.ts";

// ---------- фейковый OpenAI ----------

interface LlmRequest {
  model: string;
  input: string;
  text?: { format?: { schema?: unknown } };
}

interface EmbeddingRequest {
  model: string;
  input: string[];
}

/** Ответ LLM по схеме — та же форма, что ClaimStructure (до чистки) */
type RawStructure = ClaimStructure;

interface RawCopy {
  id: string;
  containsClaim: boolean;
  cites: string[];
  structure: RawStructure | null;
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

function apiError(status: number): Response {
  // retry-after-ms — чтобы ретраи SDK на 5xx не ждали секундами
  return json(
    { error: { message: `fake ${status}`, type: "fake_error", param: null, code: null } },
    { status, headers: { "retry-after-ms": "1" } },
  );
}

/** Векторы по тексту: первая строка текста (заголовок копии / утверждение) → вектор */
function embeddingsFor(vectors: Record<string, number[]>) {
  return (req: EmbeddingRequest) =>
    json({
      object: "list",
      model: req.model,
      data: req.input.map((text, index) => {
        const vector = vectors[text.split("\n")[0]];
        assert.ok(vector, `нет вектора для «${text.split("\n")[0]}»`);
        return { object: "embedding", index, embedding: vector };
      }),
      usage: { prompt_tokens: 1, total_tokens: 1 },
    });
}

const unset = () => {
  throw new Error("обработчик не задан в тесте");
};
let respondLlm: (req: LlmRequest) => Response = unset;
let respondEmbeddings: (req: EmbeddingRequest) => Response = unset;
let llmRequests: LlmRequest[] = [];
let embeddingRequests: EmbeddingRequest[] = [];

const realFetch = globalThis.fetch;
const llmConfig = config.providers.llm as {
  provider: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
};
const savedLlm = { ...llmConfig };

before(() => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body)) as LlmRequest;
      llmRequests.push(body);
      return respondLlm(body);
    }
    if (url.pathname.endsWith("/embeddings")) {
      const body = JSON.parse(String(init?.body)) as EmbeddingRequest;
      embeddingRequests.push(body);
      return respondEmbeddings(body);
    }
    throw new Error(`Неожиданный сетевой запрос в тесте: ${url.href}`);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  Object.assign(llmConfig, savedLlm);
});

beforeEach(() => {
  Object.assign(llmConfig, {
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-6.1-sol",
    embeddingModel: "emb-test",
  });
  llmRequests = [];
  embeddingRequests = [];
  logs.length = 0;
});

afterEach(() => {
  respondLlm = unset;
  respondEmbeddings = unset;
});

// ---------- общие данные ----------

const logs: string[] = [];
function makeCtx(): StageContext {
  return { jobId: "job_test", signal: new AbortController().signal, log: (msg) => logs.push(msg) };
}

function copy(id: string, over: Partial<SourceCopy> = {}): SourceCopy {
  return {
    id,
    url: `https://${id}.example/news/${id}`,
    title: `Заголовок ${id}`,
    publisher: `Издатель ${id}`,
    domain: `${id}.example`,
    sourceType: "news",
    language: "ru",
    excerpt: `Текст публикации ${id} о войне в Украине.`,
    outboundLinks: [],
    attributions: [],
    earliestSearch: false,
    retrievedAt: "2026-10-03T00:00:00Z",
    ...over,
  };
}

/**
 * r — Reuters (самая ранняя); x — «как сообщает Reuters» (атрибуция от 04, LLM источник не назвала);
 * y — ссылается на x (outboundLinks), утверждения в ней по мнению LLM нет.
 */
const COPIES: SourceCopy[] = [
  copy("r", { publisher: "Reuters", domain: "reuters.com", publishedAt: "2026-10-01T08:00:00Z" }),
  copy("x", { publishedAt: "2026-10-02T08:00:00Z", attributions: ["как сообщает Reuters"] }),
  copy("y", { publishedAt: "2026-10-02T12:00:00Z", outboundLinks: ["https://x.example/news/x/"] }),
];

const input: ProvenanceInput = {
  claim: mockClaim,
  copies: COPIES,
  video: { url: "https://www.youtube.com/watch?v=T", title: "Видео", publishedAt: "2026-10-03T09:00:00Z" },
};

// x не похожа на r настолько, чтобы считаться дублем (косинус ≈ 0.71 < 0.9)
const VECTORS: Record<string, number[]> = {
  [mockClaim.normalized]: [1, 0, 0],
  "Заголовок r": [1, 0, 0],
  "Заголовок x": [0.5, 0.5, 0],
  "Заголовок y": [0, 0, 1],
};

const structure = (over: Partial<RawStructure> = {}): RawStructure => ({
  event: "война в Украине",
  numbers: [],
  places: ["Украина"],
  time: null,
  certainty: "asserted",
  certaintyMarkers: [],
  attributedTo: null,
  ...over,
});

const VIDEO_FROM_LLM = structure({ event: "война (по версии LLM)" });

function extraction(copies: RawCopy[], video: RawStructure = VIDEO_FROM_LLM) {
  return { video, copies };
}

const ok = (id: string, s: RawStructure = structure(), cites: string[] = []): RawCopy => ({
  id,
  containsClaim: true,
  cites,
  structure: s,
});

function node(tree: ProvenanceTree, id: string) {
  const n = tree.nodes.find((x) => x.id === id);
  assert.ok(n, `нет узла ${id}`);
  return n;
}

const edge = (tree: ProvenanceTree, id: string) => {
  const n = node(tree, id);
  return [n.parentId, n.via, n.confidence];
};

// ---------- тесты ----------

describe("buildProvenanceTreeReal: запросы", () => {
  it("нет копий → только узел видео со структурой тезиса, без вызовов API", async () => {
    const tree = await buildProvenanceTreeReal({ ...input, copies: [] }, makeCtx());
    assert.equal(llmRequests.length + embeddingRequests.length, 0);
    assert.deepEqual(
      tree.nodes.map((n) => [n.id, n.structure]),
      [[VIDEO_NODE_ID, mockClaim.structure]],
    );
  });

  it("эмбеддинги — один batch (утверждение + копии); LLM — схема ClaimStructure, даты публикаций в промпте", async () => {
    respondEmbeddings = embeddingsFor(VECTORS);
    respondLlm = () => llmJson(extraction([ok("r"), ok("x"), ok("y")]));
    await buildProvenanceTreeReal(input, makeCtx());

    assert.equal(embeddingRequests.length, 1);
    assert.equal(embeddingRequests[0].model, "emb-test");
    assert.equal(embeddingRequests[0].input.length, 4);

    assert.equal(llmRequests.length, 1);
    const [req] = llmRequests;
    const schema = JSON.stringify(req.text?.format?.schema);
    for (const field of ["event", "about", "certaintyMarkers", "relative", "reported", "attributedTo"])
      assert.ok(schema.includes(`"${field}"`), `в схеме нет ${field}`);
    for (const old of ["eventTime", "timeMarkers", "approximate"])
      assert.ok(!schema.includes(`"${old}"`), `в схеме осталось ${old}`);
    assert.ok(
      req.input.includes('<copy id="r" publisher="Reuters" domain="reuters.com" published="2026-10-01"'),
    );
    assert.ok(req.input.includes('<video published="2026-10-03">'));
  });
});

describe("buildProvenanceTreeReal: дерево", () => {
  it("структуры из LLM почищены; атрибуция от 04 и ссылка дают рёбра; видео — структура тезиса", async () => {
    respondEmbeddings = embeddingsFor(VECTORS);
    respondLlm = () =>
      llmJson(
        extraction([
          ok(
            "r",
            structure({
              event: "  война в Украине ",
              numbers: [
                { value: " 200 ", about: " пострадавших " },
                { value: "  ", about: "пусто" },
              ],
              places: [" Украина ", "Украина", ""],
              time: { text: " вчера ", date: "2026-09-30", relative: true },
              certaintyMarkers: [" по данным ", "по данным"],
            }),
          ),
          ok(
            "x",
            structure({
              time: { text: "сейчас", date: "сегодня", relative: true },
              certainty: "reported",
              certaintyMarkers: ["как сообщает Reuters"],
              attributedTo: " Reuters ",
            }),
          ),
          { id: "y", containsClaim: false, cites: [], structure: null },
          // лишняя запись про копию, которой не было в запросе, — игнорируется
          ok("zzz"),
        ]),
      );
    const tree = await buildProvenanceTreeReal(input, makeCtx());

    assert.deepEqual(node(tree, "r").structure, {
      event: "война в Украине",
      numbers: [{ value: "200", about: "пострадавших" }],
      places: ["Украина"],
      time: { text: "вчера", date: "2026-09-30", relative: true },
      certainty: "asserted",
      certaintyMarkers: ["по данным"],
      attributedTo: null,
    });
    assert.deepEqual(node(tree, "x").structure?.time, { text: "сейчас", date: null, relative: true });
    assert.equal(node(tree, "x").structure?.attributedTo, "Reuters");
    assert.equal(node(tree, "y").structure, null);
    assert.ok(!tree.nodes.some((n) => n.id === "zzz"));

    assert.deepEqual(edge(tree, "x"), ["r", "attribution", "probable"]);
    assert.deepEqual(edge(tree, "y"), ["x", "link", "confirmed"]);
    assert.equal(tree.rootId, "r");
    assert.deepEqual(tree.voteGroups, { r: "r", x: "r", y: "r" });

    const video = tree.nodes.at(-1);
    assert.equal(video?.id, VIDEO_NODE_ID);
    assert.deepEqual(video?.structure, mockClaim.structure);
    assert.deepEqual(edge(tree, VIDEO_NODE_ID), ["r", "duplicate", "probable"]);
  });

  it("у тезиса нет structure → видео получает структуру от LLM; время только с датой — текстом служит дата", async () => {
    respondEmbeddings = embeddingsFor(VECTORS);
    respondLlm = () =>
      llmJson(
        extraction(
          [ok("r"), ok("x"), ok("y")],
          structure({ time: { text: " ", date: "2026-10", relative: false } }),
        ),
      );
    const { structure: _, ...claim } = mockClaim;
    const tree = await buildProvenanceTreeReal({ ...input, claim }, makeCtx());
    assert.deepEqual(node(tree, VIDEO_NODE_ID).structure, {
      ...structure(),
      time: { text: "2026-10", date: "2026-10", relative: false },
    });
  });

  it("cites от LLM главнее атрибуций 04: LLM назвала DW, а в тексте ещё «как сообщает Reuters»", async () => {
    const copies = [
      ...COPIES.slice(0, 2),
      copy("dw", { publisher: "Deutsche Welle", domain: "dw.com", publishedAt: "2026-10-01T20:00:00Z" }),
    ];
    respondEmbeddings = embeddingsFor({ ...VECTORS, "Заголовок dw": [0, 1, 0] });
    respondLlm = () => llmJson(extraction([ok("r"), ok("x", structure(), [" DW ", "dw", "D"]), ok("dw")]));
    const tree = await buildProvenanceTreeReal({ ...input, copies }, makeCtx());
    assert.deepEqual(edge(tree, "x"), ["dw", "attribution", "probable"]);
  });
});

describe("buildProvenanceTreeReal: сбои", () => {
  it("LLM упала → дерево без структур, но ссылки и атрибуции от 04 на месте", async () => {
    respondEmbeddings = embeddingsFor(VECTORS);
    respondLlm = () => apiError(500);
    const tree = await buildProvenanceTreeReal(input, makeCtx());
    assert.ok(tree.nodes.filter((n) => n.id !== VIDEO_NODE_ID).every((n) => n.structure === null));
    assert.deepEqual(edge(tree, "x"), ["r", "attribution", "probable"]);
    assert.deepEqual(edge(tree, "y"), ["x", "link", "confirmed"]);
    // корнем может быть только копия с утверждением
    assert.equal(tree.rootId, null);
    assert.ok(logs.some((l) => l.includes("структура не извлечена")));
  });

  it("эмбеддинги упали → дубли по шинглам, LLM всё равно вызывается", async () => {
    respondEmbeddings = () => apiError(500);
    respondLlm = () => llmJson(extraction([ok("r"), ok("x"), ok("y")]));
    const tree = await buildProvenanceTreeReal(input, makeCtx());
    assert.equal(llmRequests.length, 1);
    assert.ok(logs.some((l) => l.includes("шинглам")));
    assert.deepEqual(edge(tree, "x"), ["r", "attribution", "probable"]);
  });

  it("ошибка настройки (провайдер не openai) — бросает, а не строит пустое дерево", async () => {
    llmConfig.provider = "anthropic";
    await assert.rejects(buildProvenanceTreeReal(input, makeCtx()), LlmConfigError);
    assert.equal(llmRequests.length + embeddingRequests.length, 0);
  });
});
