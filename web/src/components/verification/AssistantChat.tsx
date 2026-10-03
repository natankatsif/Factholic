"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { Globe, RotateCcw, Sparkles } from "lucide-react";
import type { ClaimId, JobId } from "@news/contracts";
import type { StickToBottomContext } from "use-stick-to-bottom";
import { Conversation, ConversationContent, ConversationScrollButton } from "../ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "../ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "../ai-elements/prompt-input";
import { Source, Sources, SourcesContent, SourcesTrigger } from "../ai-elements/sources";
import { Suggestion, Suggestions } from "../ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader } from "../ai-elements/tool";
import { chatFor, type ChatMessage, type WebSearchResult } from "../../lib/chat";
import { plural } from "./filters";

const DEFAULT_QUESTIONS = ["Кто первоисточник?", "Что исказили?", "Когда это было?", "Есть свежие новости?"];

export interface AssistantChatProps {
  jobId: JobId;
  claimId: ClaimId;
  /** Первое сообщение ассистента — карточка разбора утверждения */
  intro: ReactNode;
  suggestedQuestions?: string[];
}

/**
 * Разбор как чат: карточка утверждения — первое сообщение, дальше вопросы (быстрые или свои) и ответы.
 * Ответы — с бэкенда (AI SDK): по данным разбора, а чего в нём нет — модель ищет в интернете (webSearch).
 */
export function AssistantChat({ jobId, claimId, intro, suggestedQuestions }: AssistantChatProps) {
  const { messages, sendMessage, status, stop, error, regenerate, clearError } = useChat<ChatMessage>({
    chat: chatFor(jobId, claimId),
  });
  const busy = status === "submitted" || status === "streaming";
  const questions = suggestedQuestions?.length ? suggestedQuestions : DEFAULT_QUESTIONS;
  const asked = new Set(messages.filter((m) => m.role === "user").map(textOf));

  // Карточку показываем с начала; к низу прокручиваем, только когда пошёл диалог
  const stick = useRef<StickToBottomContext>(null);
  useEffect(() => {
    if (messages.length) void stick.current?.scrollToBottom();
  }, [messages.length]);

  const ask = (text: string) => {
    if (busy || !text.trim()) return;
    if (error) clearError();
    void sendMessage({ text });
  };

  return (
    <>
      <Conversation className="min-h-0 flex-1" initial={false} contextRef={stick}>
        <ConversationContent className="gap-4 p-4 [@media(max-height:780px)]:p-3">
          <Message from="assistant" className="max-w-full">
            <MessageContent className="w-full overflow-visible">{intro}</MessageContent>
          </Message>

          {messages.map((m, i) => (
            <ChatBubble
              key={m.id}
              message={m}
              streaming={status === "streaming" && i === messages.length - 1}
            />
          ))}

          {status === "submitted" && <Thinking />}
          {error && <ChatError error={error} onRetry={() => void regenerate()} />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4 [@media(max-height:780px)]:gap-2 [@media(max-height:780px)]:p-3">
        <Suggestions>
          {questions
            .filter((q) => !asked.has(q))
            .map((q) => (
              <Suggestion key={q} suggestion={q} onClick={ask} disabled={busy} />
            ))}
        </Suggestions>
        <PromptInput onSubmit={({ text }) => ask(text)}>
          <PromptInputTextarea placeholder="Спросите про это утверждение…" />
          <PromptInputSubmit status={status} onStop={() => void stop()} className="self-end" />
        </PromptInput>
      </div>
    </>
  );
}

function textOf(m: ChatMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function ChatBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent>{textOf(message)}</MessageContent>
      </Message>
    );
  }
  return (
    <Message from="assistant">
      <MessageContent className="w-full gap-3">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <MessageResponse
                key={i}
                isAnimating={streaming}
                className="text-[13.5px] font-semibold leading-relaxed [&_a]:font-bold [&_a]:text-[#1660D6] [&_a]:no-underline hover:[&_a]:underline"
              >
                {part.text}
              </MessageResponse>
            );
          }
          if (part.type === "tool-webSearch") {
            return (
              <WebSearch
                key={part.toolCallId}
                state={part.state}
                query={part.input?.query}
                results={part.state === "output-available" ? part.output.results : undefined}
              />
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}

/** Вызов webSearch: что ищем и что нашли (кликабельные ссылки с датами) */
function WebSearch({
  state,
  query,
  results,
}: {
  state: Parameters<typeof ToolHeader>[0]["state"];
  query: string | undefined;
  results: WebSearchResult[] | undefined;
}) {
  return (
    <Tool>
      <ToolHeader
        state={state}
        icon={<Globe className="size-4 shrink-0 text-[#4AA5C3]" />}
        title={query ? `Ищем: «${query}»` : "Ищем в интернете…"}
      />
      <ToolContent>
        {state === "output-error" ? (
          <p className="m-0 text-xs font-semibold text-[#E2353F]">Поиск не удался</p>
        ) : results ? (
          <Sources defaultOpen>
            <SourcesTrigger count={results.length}>
              <span className="text-xs">
                Нашли {results.length} {plural(results.length, ["публикацию", "публикации", "публикаций"])}
              </span>
            </SourcesTrigger>
            <SourcesContent>
              {results.map((r) => (
                <Source key={r.url} href={r.url} title={r.title}>
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4AA5C3]" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-extrabold">{r.title}</span>
                    <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                      {hostname(r.url)}
                      {formatDate(r.publishedAt) && ` · ${formatDate(r.publishedAt)}`}
                    </span>
                  </span>
                </Source>
              ))}
            </SourcesContent>
          </Sources>
        ) : (
          <p className="m-0 animate-pulse text-xs font-semibold text-muted-foreground">Ищем публикации…</p>
        )}
      </ToolContent>
    </Tool>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold text-muted-foreground">
      <Sparkles className="h-4 w-4 animate-pulse text-[#8B5CF6]" />
      Думаем над ответом…
    </div>
  );
}

function ChatError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-[#FCDFE1] px-3 py-2.5 text-[13px] font-semibold text-[#4A3333]">
      <span className="min-w-0">{errorText(error)}</span>
      <button
        type="button"
        onClick={onRetry}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-none bg-white/70 px-3 py-1 text-xs font-extrabold text-[#4A3333] hover:bg-white"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Ещё раз
      </button>
    </div>
  );
}

/** Бэкенд отвечает { error: "…" } — показываем текст, а не JSON */
function errorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // не JSON
  }
  return error.message.includes("fetch")
    ? "Нет связи с сервером. Чат работает, когда сайт подключён к бэкенду."
    : error.message || "Не удалось получить ответ";
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(raw: string | undefined): string {
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("ru-RU");
}
