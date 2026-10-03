/**
 * Чат по разбору (AI SDK): POST /api/jobs/:id/chat на бэкенде, протокол UI-сообщений useChat.
 * Один чат на утверждение — история не пропадает, когда переключаешься между утверждениями.
 */
import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIDataTypes, type UIMessage } from "ai";
import { API_ROUTES, type ClaimId, type JobId } from "@news/contracts";
import { BACKEND_URL } from "./jobs";

/** Выдача инструмента webSearch бэкенда (backend/src/chat/search.ts, WebSearchOutput) */
export interface WebSearchResult {
  title: string;
  url: string;
  publishedAt?: string;
  snippet: string;
}

export type ChatTools = {
  webSearch: {
    input: { query: string; news: boolean };
    output: { query: string; engine: "tavily" | "openai"; results: WebSearchResult[]; summary?: string };
  };
};

export type ChatMessage = UIMessage<unknown, UIDataTypes, ChatTools>;

const chats = new Map<string, Chat<ChatMessage>>();

export function chatFor(jobId: JobId, claimId: ClaimId): Chat<ChatMessage> {
  const id = `${jobId}:${claimId}`;
  let chat = chats.get(id);
  if (!chat) {
    chat = new Chat<ChatMessage>({
      id,
      transport: new DefaultChatTransport({
        api: `${BACKEND_URL}${API_ROUTES.chat(encodeURIComponent(jobId))}`,
        body: { claimId },
      }),
    });
    chats.set(id, chat);
  }
  return chat;
}
