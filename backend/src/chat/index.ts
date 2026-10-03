/**
 * Чат по разбору: POST /api/jobs/:id/chat — протокол AI SDK (useChat + DefaultChatTransport на сайте).
 * Тело: { messages: UIMessage[], claimId? } → поток UI-сообщений (SSE). Модель отвечает по отчёту задачи и
 * при необходимости ищет в интернете (инструмент webSearch: Tavily, запасной — web search OpenAI).
 * Ключи — из config.ts (LLM_*, SEARCH_*).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  isStepCount,
  pipeUIMessageStreamToResponse,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type { VideoReport } from "@news/contracts";
import { config } from "../config.ts";
import { buildInstructions } from "./prompt.ts";
import { search } from "./search.ts";

/** Сколько шагов «поиск → ответ» модель может сделать за один вопрос: каждый поиск — 5–10 с ожидания */
const MAX_STEPS = 3;
const MAX_MESSAGES = 30;

export interface ChatRequestBody {
  messages: UIMessage[];
  /** Утверждение, по которому открыт чат (первое сообщение — его карточка) */
  claimId?: string;
}

/** Каких ключей не хватает, чтобы чат работал; пусто — всё есть. Без Tavily ищем через OpenAI */
export function chatConfigErrors(): string[] {
  const { llm } = config.providers;
  return llm.provider !== "openai" || !llm.apiKey || !llm.model
    ? ["LLM_PROVIDER=openai, LLM_API_KEY, LLM_MODEL"]
    : [];
}

export async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  report: VideoReport,
  body: ChatRequestBody,
): Promise<void> {
  const log = (msg: string, data?: unknown) => console.log(`[${report.jobId}] chat: ${msg}`, data ?? "");

  // пользователь закрыл страницу или нажал «стоп» — не тратим токены и запросы поиска
  const abort = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  const messages = body.messages.slice(-MAX_MESSAGES);
  const question = messages.at(-1)?.parts.find((p) => p.type === "text");
  log(
    `вопрос по ${body.claimId ?? "—"}: ${question && "text" in question ? question.text.slice(0, 200) : ""}`,
  );

  const openai = createOpenAI({ apiKey: config.providers.llm.apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const tools = {
    webSearch: tool({
      description:
        "Поиск в интернете: свежие новости, первоисточники, опровержения, официальные заявления. " +
        "Возвращает заголовки, ссылки, даты и выдержки.",
      inputSchema: z.object({
        query: z.string().describe("Поисковый запрос, на языке, на котором вероятнее всего писали об этом"),
        news: z.boolean().describe("true — искать среди новостей (свежие события), false — везде"),
      }),
      execute: async ({ query, news }, { abortSignal }) => {
        log(`webSearch «${query}»${news ? " (новости)" : ""}`);
        const output = await search(query, { news, signal: abortSignal ?? abort.signal, log });
        log(`webSearch (${output.engine}): ${output.results.length} результатов`);
        return output;
      },
    }),
  };

  const result = streamText({
    model: openai(config.providers.llm.model),
    instructions: buildInstructions(report, body.claimId, today),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    // ответ в чат — по готовому разбору, долго рассуждать не нужно: первый токен ~1 с вместо ~2,5 с
    providerOptions: { openai: { reasoningEffort: "low" } },
    abortSignal: abort.signal,
    onError: ({ error }) => log("ошибка", error),
  });

  await pipeUIMessageStreamToResponse({
    response: res,
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      onError: (error) => {
        log("ошибка потока", error);
        return "Не удалось получить ответ, попробуйте ещё раз";
      },
    }),
  });
}
