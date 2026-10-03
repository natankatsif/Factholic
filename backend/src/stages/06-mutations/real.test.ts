/**
 * Этап 06 целиком, без сети: globalThis.fetch подменён фейком OpenAI Responses API,
 * ключ/провайдер/модель подставляются мутацией config.providers.llm.
 * OpenAI-клиент кешируется в llm.ts при первом вызове вместе с fetch, поэтому фейк ставится один раз на файл
 * и только переключает обработчик.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import { mockClaim } from "../03-claim-extraction/mock.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import { VIDEO_NODE_ID, type ProvenanceTree, type TreeNode } from "../05-provenance/types.ts";
import { LlmConfigError } from "./llm.ts";
import { findMutationsReal } from "./real.ts";
import type { MutationsInput } from "./types.ts";

// ---------- фейковый OpenAI ----------

interface LlmRequest {
  model: string;
  instructions: string;
  input: string;
  reasoning?: { effort?: string };
}

interface RawDecision {
  candidateId: string;
  confirmed: boolean;
  note: string;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function llmDecisions(decisions: RawDecision[]): Response {
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
        content: [{ type: "output_text", text: JSON.stringify({ decisions }), annotations: [] }],
      },
    ],
    incomplete_details: null,
    error: null,
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  });
}

function llmError(status: number): Response {
  // retry-after-ms — чтобы ретраи SDK на 429/5xx не ждали секундами
  return json(
    { error: { message: `fake ${status}`, type: "fake", param: null, code: null } },
    { status, headers: { "retry-after-ms": "1" } },
  );
}

let respond: (req: LlmRequest) => Response;
let requests: LlmRequest[] = [];

const realFetch = globalThis.fetch;
const llmConfig = config.providers.llm as { provider: string; apiKey: string; model: string };
const savedLlm = { ...llmConfig };

before(() => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body)) as LlmRequest;
      requests.push(body);
      return respond(body);
    }
    throw new Error(`Неожиданный сетевой запрос в тесте: ${url.href}`);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  Object.assign(llmConfig, savedLlm);
});

/** Подтвердить всех кандидатов из запроса с note «note cN» */
const confirmAll = (req: LlmRequest) =>
  llmDecisions(
    [...req.input.matchAll(/^- (c\d+) \[/gm)].map(([, id]) => ({
      candidateId: id,
      confirmed: true,
      note: `note ${id}`,
    })),
  );

beforeEach(() => {
  Object.assign(llmConfig, { provider: "openai", apiKey: "sk-test", model: "gpt-6.1-sol" });
  requests = [];
  respond = confirmAll;
});

const ctx: StageContext = { jobId: "job_test", signal: new AbortController().signal, log: () => {} };

// ---------- дерево ----------

/** Первоисточник: «по данным мэрии, 2 пострадавших», 14 января 2021 */
const original: ClaimStructure = {
  event: "пожар на складе",
  numbers: [{ value: "2", about: "пострадавших" }],
  places: ["Кишинёв"],
  time: { text: "14 января 2021 года", date: "2021-01-14", relative: false },
  certainty: "reported",
  certaintyMarkers: ["по данным мэрии"],
  attributedTo: "мэрия Кишинёва",
};

/** Перепечатка через 5 лет: «вчера, 200 пострадавших», как факт и без ссылки */
const inflated: ClaimStructure = {
  event: "пожар на складе",
  numbers: [{ value: "200", about: "пострадавших" }],
  places: ["Кишинёв"],
  time: { text: "вчера", date: "2026-10-01", relative: true },
  certainty: "asserted",
  certaintyMarkers: [],
  attributedTo: null,
};

function node(
  id: string,
  parentId: string | null,
  publishedAt: string,
  structure: ClaimStructure | null,
): TreeNode {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    publisher: id === VIDEO_NODE_ID ? "Это видео" : `Издание ${id}`,
    domain: "example.com",
    publishedAt,
    parentId,
    via: parentId ? "link" : null,
    confidence: parentId ? "confirmed" : null,
    structure,
  };
}

/** src_1 (первоисточник) ← src_2 (раздул) ← video (пересказал src_2 точно) */
function makeInput(
  video: ClaimStructure | null = inflated,
  child: ClaimStructure = inflated,
): MutationsInput {
  const tree: ProvenanceTree = {
    claimId: "clm_t",
    rootId: "src_1",
    nodes: [
      node("src_1", null, "2021-01-14T07:30:00Z", original),
      node("src_2", "src_1", "2026-10-02T07:00:00Z", child),
      node(VIDEO_NODE_ID, "src_2", "2026-10-02T09:00:00Z", video),
    ],
    voteGroups: {},
  };
  return { claim: { ...mockClaim, id: "clm_t", structure: inflated }, tree, uiLanguage: "ru" };
}

const EXPECTED_CANDIDATES = [
  { field: "numbers", before: "2 пострадавших", after: "200 пострадавших", direction: "inflated" },
  { field: "time", before: "14 января 2021 года", after: "вчера (1 октября 2026)", direction: "shifted" },
  { field: "certainty", before: "со ссылкой на источник", after: "как факт", direction: "inflated" },
  { field: "attribution", before: "мэрия Кишинёва", after: "без ссылки на источник", direction: "changed" },
];

// ---------- тесты ----------

describe("findMutationsReal: пары и кандидаты", () => {
  it("ребро src_1 → src_2 и путь корень → video; ребро src_2 → video без изменений в LLM не идёт", async () => {
    const out = await findMutationsReal(makeInput(), ctx);
    assert.equal(out.claimId, "clm_t");
    assert.deepEqual(out.mutations, [
      ...EXPECTED_CANDIDATES.map((c, i) => ({
        fromId: "src_1",
        toId: "src_2",
        ...c,
        note: `note c${i + 1}`,
      })),
      ...EXPECTED_CANDIDATES.map((c, i) => ({
        fromId: "src_1",
        toId: VIDEO_NODE_ID,
        ...c,
        note: `note c${i + 5}`,
      })),
    ]);
    assert.equal(requests.length, 1);
  });

  it("промпт: новая структура (событие, числа с about, время с relative, маркеры уверенности)", async () => {
    await findMutationsReal(makeInput(), ctx);
    const [req] = requests;
    assert.equal(req.reasoning?.effort, "low");
    assert.match(req.instructions, /added \/ removed/);
    assert.match(req.input, /ПАРЫ \(ровно 2: p1, p2\)/);
    assert.match(req.input, /КАНДИДАТЫ \(ровно 8: c1, c2, c3, c4, c5, c6, c7, c8\)/);
    assert.match(req.input, /событие: пожар на складе/);
    assert.match(req.input, /числа: «2» пострадавших/);
    assert.match(req.input, /числа: «200» пострадавших/);
    assert.match(req.input, /время: «14 января 2021 года» \(2021-01-14\)/);
    assert.match(req.input, /время: «вчера» \(2026-10-01, относительно даты публикации\)/);
    assert.match(req.input, /уверенность: reported \(«по данным мэрии»\)/);
    assert.match(req.input, /ссылается на: мэрия Кишинёва/);
    assert.match(req.input, /- c1 \[numbers, inflated\]: «2 пострадавших» → «200 пострадавших»/);
  });

  it("у узла video нет structure → берётся structure тезиса из этапа 03", async () => {
    const out = await findMutationsReal(makeInput(null), ctx);
    assert.equal(out.mutations.filter((m) => m.toId === VIDEO_NODE_ID).length, 4);
  });

  it("перепечатывали точно → LLM не вызывается, мутаций нет", async () => {
    const out = await findMutationsReal(makeInput(original, original), ctx);
    assert.deepEqual(out, { claimId: "clm_t", mutations: [] });
    assert.equal(requests.length, 0);
  });
});

describe("findMutationsReal: решения LLM", () => {
  it("отклонённый кандидат выпадает, пропущенный LLM остаётся с шаблонным note", async () => {
    respond = () =>
      llmDecisions([
        { candidateId: "c1", confirmed: true, note: "Число пострадавших выросло в 100 раз." },
        { candidateId: "c2", confirmed: true, note: "Пожар 2021 года подан как вчерашний." },
        { candidateId: "c3", confirmed: false, note: "" },
        // c4 пропущен; c5–c8 — тоже
      ]);
    const out = await findMutationsReal(makeInput(), ctx);
    const fromChild = out.mutations.filter((m) => m.toId === "src_2");
    assert.deepEqual(
      fromChild.map((m) => [m.field, m.note]),
      [
        ["numbers", "Число пострадавших выросло в 100 раз."],
        ["time", "Пожар 2021 года подан как вчерашний."],
        ["attribution", "Изменилось, на кого ссылаются: «мэрия Кишинёва» → «без ссылки на источник»."],
      ],
    );
    assert.equal(out.mutations.length, 7);
  });

  it("LLM не ответила (500) → кандидаты кода с шаблонными note", async () => {
    respond = () => llmError(500);
    const out = await findMutationsReal(makeInput(), ctx);
    assert.deepEqual(
      out.mutations.filter((m) => m.toId === "src_2").map((m) => m.note),
      [
        "Число выросло: «2 пострадавших» → «200 пострадавших».",
        "Событие сдвинуто во времени: «14 января 2021 года» → «вчера (1 октября 2026)».",
        "Подано увереннее: «со ссылкой на источник» → «как факт».",
        "Изменилось, на кого ссылаются: «мэрия Кишинёва» → «без ссылки на источник».",
      ],
    );
  });

  it("LLM не настроена → LlmConfigError, запроса нет", async () => {
    llmConfig.provider = "anthropic";
    await assert.rejects(findMutationsReal(makeInput(), ctx), LlmConfigError);
    assert.equal(requests.length, 0);
  });
});
