/**
 * Вызов LLM со structured output (ответ строго по zod-схеме). Провайдер, ключ и модель — config.providers.llm.
 * Такой же файл лежит в 04 и 05: этапы не импортируют код друг друга (см. backend/AGENTS.md).
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
    throw new LlmConfigError(`LLM_PROVIDER="${provider}" не поддерживается: этапы 03–05 написаны под openai`);
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
  /** Быстрая модель (LLM_MODEL_FAST) — для быстрого пречека и извлечения тезисов без задержки */
  fast?: boolean;
  /**
   * Таймаут одной попытки (мс). Запросы к OpenAI иногда «зависают» на минуту и больше, хотя обычно идут 4 с
   * (замер: 81 с и 118 с вместо 4 с). Короткий таймаут + повтор SDK ограничивает такое зависание.
   */
  timeoutMs?: number;
}

function modelOf(params: { fast?: boolean }): string {
  if (params.fast !== false && config.providers.llm.fastModel) {
    return config.providers.llm.fastModel;
  }
  return config.providers.llm.model;
}

export async function askJson<S extends z.ZodType>(
  params: AskJsonParams<S>,
  ctx: StageContext,
): Promise<{ data: z.infer<S>; model: string }> {
  const chosenModel = modelOf(params);
  const res = await getClient().responses.parse(
    {
      model: chosenModel,
      instructions: params.system,
      input: params.prompt,
      // у моделей без «размышления» (gpt-4.x, gpt-3.5) параметра reasoning нет — API его отклонит
      ...(/^gpt-(3|4)/.test(chosenModel) ? {} : { reasoning: { effort: params.effort } }),
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
