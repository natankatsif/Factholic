/**
 * Вызов LLM со structured output (ответ строго по zod-схеме) и эмбеддинги. Провайдер, ключ и модели —
 * config.providers.llm. Такой же askJson лежит в 03, 04 и 08: этапы не импортируют код друг друга
 * (см. backend/AGENTS.md).
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { config } from "../../config.ts";
import type { StageContext } from "../../pipeline/context.ts";

/** Ошибка настройки (.env), а не временный сбой: её нельзя глотать, иначе этап молча ничего не делает */
export class LlmConfigError extends Error {}

let client: OpenAI | undefined;

function getClient(): OpenAI {
  const { provider, apiKey } = config.providers.llm;
  if (provider !== "openai")
    throw new LlmConfigError(`LLM_PROVIDER="${provider}" не поддерживается: этапы с LLM написаны под openai`);
  if (!apiKey) throw new LlmConfigError("LLM_API_KEY не задан (корневой .env)");
  // по умолчанию SDK ждёт 10 минут и делает 2 повтора — зависший запрос остановил бы весь job
  client ??= new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  return client;
}

export interface AskJsonParams<S extends z.ZodType> {
  effort: "low" | "medium" | "high";
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
  /** Быстрая модель (LLM_MODEL_FAST) — для механической работы без суждений */
  fast?: boolean;
  /**
   * Таймаут одной попытки (мс). Запросы к OpenAI иногда «зависают» (замер: пачка 4 с, а одна — 47 с);
   * короткий таймаут + повтор SDK ограничивает такое зависание.
   */
  timeoutMs?: number;
}

export async function askJson<S extends z.ZodType>(
  params: AskJsonParams<S>,
  ctx: StageContext,
): Promise<{ data: z.infer<S>; model: string }> {
  const res = await getClient().responses.parse(
    {
      model: modelOf(params),
      instructions: params.system,
      input: params.prompt,
      // у моделей без «размышления» (gpt-4.x, gpt-3.5) параметра reasoning нет — API его отклонит
      ...(/^gpt-(3|4)/.test(modelOf(params)) ? {} : { reasoning: { effort: params.effort } }),
      max_output_tokens: params.maxTokens ?? 16000,
      text: { format: zodTextFormat(params.schema, "result") },
      // расшифровки и тексты страниц не нужно хранить на стороне OpenAI
      store: false,
    },
    { signal: ctx.signal, ...(params.timeoutMs ? { timeout: params.timeoutMs } : {}) },
  );

  if (res.status === "incomplete")
    throw new Error(`Ответ LLM неполный: ${res.incomplete_details?.reason ?? "причина неизвестна"}`);
  for (const item of res.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type === "refusal") throw new Error(`LLM отказалась отвечать: ${content.refusal}`);
    }
  }
  const data = res.output_parsed as z.infer<S> | null;
  if (data === null) throw new Error("LLM вернула ответ не по схеме");
  return { data, model: res.model };
}

/**
 * Эмбеддинги (config.providers.llm.embeddingModel) одним batch-запросом: i-й вектор — для texts[i].
 * Пустые строки API не принимает — вызывающий подставляет непустой текст.
 */
export async function embed(texts: string[], ctx: StageContext): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await getClient().embeddings.create(
    { model: config.providers.llm.embeddingModel, input: texts },
    { signal: ctx.signal },
  );

  const vectors = new Array<number[] | undefined>(texts.length);
  for (const item of res.data) {
    if (Number.isInteger(item.index) && item.index >= 0 && item.index < texts.length)
      vectors[item.index] = Array.from(item.embedding);
  }
  const dim = vectors[0]?.length ?? 0;
  for (const v of vectors) {
    if (!v || !dim) throw new Error("Эмбеддинги: ответ не на все тексты");
    if (v.length !== dim || !v.every(Number.isFinite)) throw new Error("Эмбеддинги: векторы разной длины");
  }
  return vectors as number[][];
}

function modelOf(params: { fast?: boolean }): string {
  return params.fast ? config.providers.llm.fastModel : config.providers.llm.model;
}
