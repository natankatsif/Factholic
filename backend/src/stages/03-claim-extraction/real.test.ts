/**
 * Этап 03 целиком, без сети: globalThis.fetch подменён фейком OpenAI Responses API,
 * ключ/провайдер/модель подставляются мутацией config.providers.llm.
 * OpenAI-клиент кешируется в llm.ts при первом вызове вместе с fetch, поэтому фейк ставится один раз на файл
 * и только переключает обработчик.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import OpenAI from "openai";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";
import type { TranscriptSegment } from "../02-transcription/types.ts";
import { LlmConfigError } from "./llm.ts";
import { mockClaimExtractionInput } from "./mock.ts";
import { extractClaimsReal } from "./real.ts";
import type { ClaimExtractionInput, ClaimStructure } from "./types.ts";

// ---------- фейковый OpenAI ----------

interface LlmRequest {
  model: string;
  instructions: string;
  input: string;
  reasoning?: { effort?: string };
  store?: boolean;
}

interface RawClaim {
  segmentIds: string[];
  quote: string;
  normalized: string;
  category: string;
  checkworthiness: number;
  entities: string[];
  structure?: ClaimStructure;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function llmResponse(content: unknown[], over: Record<string, unknown> = {}): Response {
  return json({
    id: "resp_test",
    object: "response",
    created_at: 0,
    status: "completed",
    model: "gpt-6.1-sol",
    output: [{ type: "message", id: "msg_1", status: "completed", role: "assistant", content }],
    incomplete_details: null,
    error: null,
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    ...over,
  });
}

const llmText = (text: string) => llmResponse([{ type: "output_text", text, annotations: [] }]);
const llmClaims = (claims: Array<Partial<RawClaim>>) =>
  llmText(JSON.stringify({ claims: claims.map((c) => ({ ...claimDefaults, ...c })) }));

function llmError(status: number, code: string | null = null): Response {
  // retry-after-ms — чтобы ретраи SDK на 429/5xx не ждали секундами
  return json(
    { error: { message: `fake ${status}`, type: "fake_error", param: null, code } },
    { status, headers: { "retry-after-ms": "1" } },
  );
}

const claimDefaults: RawClaim = {
  segmentIds: ["0_1"],
  quote: "В Украине сейчас идёт война",
  normalized: "На территории Украины идёт война.",
  category: "event",
  checkworthiness: 0.9,
  entities: ["Украина"],
};

let respond: (req: LlmRequest) => Response = () => {
  throw new Error("обработчик LLM не задан в тесте");
};
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

beforeEach(() => {
  Object.assign(llmConfig, { provider: "openai", apiKey: "sk-test", model: "gpt-6.1-sol" });
  requests = [];
});

afterEach(() => {
  respond = () => {
    throw new Error("обработчик LLM не задан в тесте");
  };
});

// ---------- общие данные ----------

const logs: string[] = [];
function makeCtx(signal: AbortSignal = new AbortController().signal): StageContext {
  return { jobId: "job_test", signal, log: (msg) => logs.push(msg) };
}

const input: ClaimExtractionInput = { ...mockClaimExtractionInput, jobId: "job_test" };
const [seg0, seg1, seg2] = mockClaimExtractionInput.segments;

// ---------- тесты ----------

describe("extractClaimsReal: запрос к LLM", () => {
  it("нет новых сегментов → пустой результат без вызова LLM", async () => {
    assert.deepEqual(await extractClaimsReal({ ...input, segments: [] }, makeCtx()), { claims: [] });
    assert.equal(requests.length, 0);
  });

  it("модель из config, effort low, системный промпт в instructions, сегменты и уже найденное в input", async () => {
    llmConfig.model = "gpt-test-model";
    respond = () => llmClaims([]);
    await extractClaimsReal(input, makeCtx());
    assert.equal(requests.length, 1);
    const [req] = requests;
    assert.equal(req.model, "gpt-test-model");
    assert.equal(req.reasoning?.effort, "low");
    assert.match(req.instructions, /проверяемые утверждения/);
    assert.ok(req.input.includes("[0_1] 1221.0–1223.0 SPEAKER_1: В Украине сейчас идёт война,"));
    assert.ok(req.input.includes("В следующем году инфляция снизится вдвое."));
    assert.equal(req.store, false);
  });
});

describe("extractClaimsReal: разбор ответа", () => {
  it("тезис получает точный range по словам, jobId и язык из входа, спикера из сегмента", async () => {
    respond = () => llmClaims([{ entities: [" Украина ", "Украина", "", "ООН"] }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.equal(claims.length, 1);
    const [claim] = claims;
    assert.deepEqual(claim.range, { start: 1221.0, end: 1223.0 });
    assert.equal(claim.jobId, "job_test");
    assert.equal(claim.language, "ru");
    assert.equal(claim.speaker, "SPEAKER_1");
    assert.equal(claim.quote, "В Украине сейчас идёт война");
    assert.equal(claim.normalized, "На территории Украины идёт война.");
    assert.equal(claim.category, "event");
    assert.deepEqual(claim.segmentIds, ["0_1"]);
    assert.deepEqual(claim.entities, ["Украина", "ООН"]);
  });

  it("сохраняет структуру тезиса (structure), если модель её вернула", async () => {
    respond = () =>
      llmClaims([
        {
          structure: {
            numbers: [{ value: 50000, unit: "человек", approximate: true, raw: "около 50 тысяч" }],
            places: ["Кишинёв"],
            eventTime: { raw: "вчера", date: "2026-10-02" },
            timeMarkers: ["yesterday"],
            certainty: "asserted",
            attributedTo: "Минздрав",
          },
        },
      ]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.equal(claims.length, 1);
    assert.deepEqual(claims[0].structure, {
      numbers: [{ value: 50000, unit: "человек", approximate: true, raw: "около 50 тысяч" }],
      places: ["Кишинёв"],
      eventTime: { raw: "вчера", date: "2026-10-02" },
      timeMarkers: ["yesterday"],
      certainty: "asserted",
      attributedTo: "Минздрав",
    });
  });

  it("id генерирует код: формат clm_xxxxxxxx, уникальны в ответе и между вызовами", async () => {
    respond = () =>
      llmClaims([
        { normalized: "Тезис один." },
        { normalized: "Тезис два.", segmentIds: ["0_2"], quote: "влияет на цены" },
        { normalized: "Тезис три.", segmentIds: ["0_0"], quote: "что происходит в мире" },
      ]);
    const first = await extractClaimsReal(input, makeCtx());
    const second = await extractClaimsReal(input, makeCtx());
    const ids = [...first.claims, ...second.claims].map((c) => c.id);
    assert.equal(ids.length, 6);
    for (const id of ids) assert.match(id, /^clm_[0-9a-f]{8}$/);
    assert.equal(new Set(ids).size, 6);
    assert.ok(!ids.includes("clm_04"));
  });

  it("дубли внутри ответа отбрасываются (регистр, ё и пунктуация не важны)", async () => {
    respond = () =>
      llmClaims([
        { normalized: "На территории Украины идёт война." },
        { normalized: "на территории украины идет война", quote: "идёт война" },
        { normalized: "Цены выросли.", segmentIds: ["0_2"], quote: "влияет на цены" },
      ]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(
      claims.map((c) => c.normalized),
      ["На территории Украины идёт война.", "Цены выросли."],
    );
  });

  it("тезисы, уже найденные раньше (previousClaims), не повторяются", async () => {
    respond = () =>
      llmClaims([
        {
          normalized: "в следующем году инфляция снизится вдвое",
          segmentIds: ["0_2"],
          quote: "влияет на цены",
        },
        { normalized: "На территории Украины идёт война." },
      ]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(
      claims.map((c) => c.normalized),
      ["На территории Украины идёт война."],
    );
  });

  it("неверный segmentId → сегмент находится по словам цитаты", async () => {
    respond = () =>
      llmClaims([{ segmentIds: ["9_9"], quote: "влияет на цены", normalized: "Война влияет на цены." }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.equal(claims.length, 1);
    assert.deepEqual(claims[0].segmentIds, ["0_2"]);
    assert.deepEqual(claims[0].range, { start: 1226.09, end: 1228.45 });
    assert.equal(claims[0].speaker, "SPEAKER_1");
  });

  it("без segmentIds сегмент тоже находится по словам цитаты", async () => {
    respond = () => llmClaims([{ segmentIds: [] }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(claims[0]?.segmentIds, ["0_1"]);
  });

  it("цитаты нет в новых сегментах (неверный id, слова из контекста) → тезис отбрасывается", async () => {
    const context: TranscriptSegment[] = [
      { id: "ctx_0", start: 1190, end: 1195, text: "Квартал завершился ростом экономики на три процента." },
    ];
    respond = () =>
      llmClaims([
        {
          segmentIds: ["ctx_0"],
          quote: "Квартал завершился ростом экономики",
          normalized: "Квартал завершился ростом экономики на 3%.",
          category: "statistic",
        },
        { segmentIds: ["9_9"], quote: "инфляция ускорилась до рекорда", normalized: "Инфляция ускорилась." },
      ]);
    const { claims } = await extractClaimsReal({ ...input, context }, makeCtx());
    assert.deepEqual(claims, []);
  });

  it("LLM указала не тот сегмент → цитата ищется во всех новых, сегменты — по найденному месту", async () => {
    respond = () => llmClaims([{ segmentIds: ["0_0"] }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(claims[0]?.segmentIds, ["0_1"]);
    assert.deepEqual(claims[0]?.range, { start: 1221.0, end: 1223.0 });
  });

  it("цитата через два сегмента без segmentIds → оба сегмента и точный range", async () => {
    respond = () =>
      llmClaims([{ segmentIds: [], quote: "Украине сейчас идёт война, и это, конечно, влияет" }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(claims[0]?.segmentIds, ["0_1", "0_2"]);
    assert.deepEqual(claims[0]?.range, { start: 1221.1, end: 1227.11 });
  });

  it("цитата перефразирована (нашлось < 50% слов) → тезис отбрасывается, даже при верном segmentId", async () => {
    respond = () =>
      llmClaims([
        { segmentIds: ["0_1"], quote: "на Украине продолжаются боевые действия армии" },
        { segmentIds: ["0_2"], quote: "инфляция ускорилась", normalized: "Инфляция ускорилась." },
      ]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(claims, []);
  });

  it("ровно половина слов цитаты нашлась → тезис принимается", async () => {
    respond = () => llmClaims([{ segmentIds: ["0_1"], quote: "в Украине вчера шла" }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.equal(claims.length, 1);
  });

  it("segmentIds сортируются по времени, несуществующие id игнорируются", async () => {
    respond = () =>
      llmClaims([
        {
          segmentIds: ["0_2", "9_9", "0_1"],
          quote: "Украине сейчас идёт война, и это, конечно, влияет",
          normalized: "Война в Украине влияет на цены.",
        },
      ]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(claims[0].segmentIds, ["0_1", "0_2"]);
    assert.deepEqual(claims[0].range, { start: 1221.1, end: 1227.11 });
  });

  it("checkworthiness прижимается к 0..1", async () => {
    respond = () =>
      llmClaims([
        { normalized: "Первый.", checkworthiness: 1.7 },
        { normalized: "Второй.", checkworthiness: -0.2, segmentIds: ["0_2"], quote: "влияет на цены" },
        { normalized: "Третий.", checkworthiness: 0.65, segmentIds: ["0_0"], quote: "что происходит в мире" },
      ]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(
      claims.map((c) => c.checkworthiness),
      [1, 0, 0.65],
    );
  });

  it("пустые quote или normalized → тезис отбрасывается", async () => {
    respond = () => llmClaims([{ quote: "   " }, { normalized: "" }, { normalized: "Нормальный." }]);
    const { claims } = await extractClaimsReal(input, makeCtx());
    assert.deepEqual(
      claims.map((c) => c.normalized),
      ["Нормальный."],
    );
  });

  it("сегмент без спикера → тезис без speaker", async () => {
    const segments = [{ ...seg1, speaker: undefined }, seg2];
    respond = () => llmClaims([{}]);
    const { claims } = await extractClaimsReal({ ...input, segments }, makeCtx());
    assert.equal(claims[0].speaker, undefined);
  });

  it("тезис, отброшенный из-за цитаты вне нового текста, не блокирует такой же тезис с верной цитатой", async () => {
    const context: TranscriptSegment[] = [
      { id: "ctx_0", start: 1190, end: 1195, text: "Военный конфликт продолжается уже несколько лет." },
    ];
    respond = () =>
      llmClaims([
        { segmentIds: ["ctx_0"], quote: "Военный конфликт продолжается уже несколько лет" },
        { segmentIds: ["0_1"], quote: "В Украине сейчас идёт война" },
      ]);
    const { claims } = await extractClaimsReal(
      { ...input, context, segments: [seg0, seg1, seg2] },
      makeCtx(),
    );
    assert.equal(claims.length, 1);
    assert.deepEqual(claims[0].segmentIds, ["0_1"]);
  });
});

describe("extractClaimsReal: сбои LLM", () => {
  it("временный сбой (500 после ретраев SDK) → claims: [], job идёт дальше", async () => {
    respond = () => llmError(500);
    logs.length = 0;
    assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] });
    assert.ok(requests.length >= 1);
    assert.ok(logs.some((l) => l.includes("кусок пропущен")));
  });

  it("429 после ретраев → claims: []", async () => {
    respond = () => llmError(429);
    assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] });
  });

  it("ответ не JSON или не по схеме → claims: []", async () => {
    respond = () => llmText("это не JSON");
    assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] });

    respond = () => llmText(JSON.stringify({ claims: [{ ...claimDefaults, category: "opinion" }] }));
    assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] });
  });

  it("отказ модели (refusal) → claims: []", async () => {
    respond = () => llmResponse([{ type: "refusal", refusal: "не могу" }]);
    assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] });
  });

  it("ответ обрезан по max_output_tokens → claims: []", async () => {
    respond = () =>
      llmResponse([{ type: "output_text", text: '{"claims": [', annotations: [] }], {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      });
    assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] });
  });

  it("400 (ошибка запроса/модели) → исключение без ретраев", async () => {
    respond = () => llmError(400);
    await assert.rejects(extractClaimsReal(input, makeCtx()), OpenAI.BadRequestError);
    assert.equal(requests.length, 1);
  });

  it("400 из-за содержимого куска (invalid_prompt, context_length_exceeded) → кусок пропускается", async () => {
    for (const code of ["invalid_prompt", "context_length_exceeded"]) {
      respond = () => llmError(400, code);
      assert.deepEqual(await extractClaimsReal(input, makeCtx()), { claims: [] }, code);
    }
  });

  it("400 с другим кодом → исключение", async () => {
    respond = () => llmError(400, "invalid_value");
    await assert.rejects(extractClaimsReal(input, makeCtx()), OpenAI.BadRequestError);
  });

  it("403 (нет доступа к модели) → исключение", async () => {
    respond = () => llmError(403);
    await assert.rejects(extractClaimsReal(input, makeCtx()), OpenAI.PermissionDeniedError);
  });

  it("401 (неверный ключ) → исключение", async () => {
    respond = () => llmError(401);
    await assert.rejects(extractClaimsReal(input, makeCtx()), OpenAI.AuthenticationError);
  });

  it("404 (нет такой модели) → исключение", async () => {
    respond = () => llmError(404);
    await assert.rejects(extractClaimsReal(input, makeCtx()), OpenAI.NotFoundError);
  });

  it("неподдерживаемый провайдер → LlmConfigError пробрасывается, запроса нет", async () => {
    llmConfig.provider = "anthropic";
    await assert.rejects(extractClaimsReal(input, makeCtx()), LlmConfigError);
    assert.equal(requests.length, 0);
  });

  it("пустой ключ → LlmConfigError пробрасывается, запроса нет", async () => {
    llmConfig.apiKey = "";
    await assert.rejects(extractClaimsReal(input, makeCtx()), LlmConfigError);
    assert.equal(requests.length, 0);
  });

  it("отмена (signal aborted) → исключение, а не тихий пустой результат", async () => {
    const controller = new AbortController();
    controller.abort();
    respond = () => llmClaims([{}]);
    await assert.rejects(extractClaimsReal(input, makeCtx(controller.signal)), OpenAI.APIUserAbortError);
  });
});
