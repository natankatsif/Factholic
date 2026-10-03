/**
 * Вызов LLM со structured output (ответ строго по zod-схеме). Провайдер, ключ и модель — config.providers.llm.
 * Копия 08-stances/llm.ts (такой же файл в 03 и 04): этапы не импортируют код друг друга (см. backend/AGENTS.md).
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
}

export async function askJson<S extends z.ZodType>(
  params: AskJsonParams<S>,
  ctx: StageContext,
): Promise<{ data: z.infer<S>; model: string }> {
  const res = await getClient().responses.parse(
    {
      model: config.providers.llm.model,
      instructions: params.system,
      input: params.prompt,
      reasoning: { effort: params.effort },
      max_output_tokens: params.maxTokens ?? 16000,
      text: { format: zodTextFormat(params.schema, "result") },
      // расшифровки и тексты страниц не нужно хранить на стороне OpenAI
      store: false,
    },
    { signal: ctx.signal },
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
