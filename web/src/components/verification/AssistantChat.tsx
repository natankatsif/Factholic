import React, { useState } from "react";
import { ArrowUp, Mic, Sparkles, X } from "lucide-react";
import type { FactCheck } from "@news/contracts";

export interface AssistantChatProps {
  currentClaim: FactCheck;
  suggestedQuestions?: string[];
  onAskQuestion?: (q: string) => void;
}

export function AssistantChat({
  currentClaim,
  suggestedQuestions = ["Кто первоисточник?", "Что исказили?", "Когда это было?"],
  onAskQuestion,
}: AssistantChatProps) {
  const [inputVal, setInputVal] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleAsk = (query: string) => {
    const q = query.trim();
    if (!q) return;

    let reply = "";
    const lower = q.toLowerCase();

    if (lower.includes("первоисточник") || lower.includes("источник")) {
      reply =
        "Первоисточник — «Новости MD» от 14.03.2023. В исходном сообщении речь шла о локальном возгорании склада рядом с ТЦ (2 пострадавших).";
    } else if (lower.includes("исказ") || lower.includes("разду") || lower.includes("цифр")) {
      reply =
        "Искажения произошли по цепочке: в сентябре 2026 канал «Срочно MD» заменил «склад» на «ТЦ», а в октябре канал «Город MD» увеличил число пострадавших в 100 раз (2 → 200) и заявил, что пожар произошёл «вчера».";
    } else if (lower.includes("когда") || lower.includes("время") || lower.includes("дат")) {
      reply =
        "Событие произошло 14 марта 2023 года (3,5 года назад). В сюжете же старый инцидент преподнесён как вчерашнее ЧП.";
    } else {
      reply = `По утверждению «${currentClaim.claim}»: проверено по ${currentClaim.sources.length} источникам. Выявлено искажение масштаба и замалчивание реальной даты.`;
    }

    setChatLog((prev) => [...prev, { sender: "user", text: q }, { sender: "ai", text: reply }]);
    setInputVal("");
    setIsOpen(true);
    if (onAskQuestion) onAskQuestion(q);
  };

  return (
    <div className="relative flex flex-col gap-3 [@media(max-height:780px)]:gap-2">
      {/* Быстрые вопросы */}
      <div className="flex flex-wrap items-center gap-2">
        {suggestedQuestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleAsk(q)}
            className="cursor-pointer whitespace-nowrap rounded-full border border-[#E3D9D6] bg-[#FBF8F7] px-3 py-1.5 text-xs font-bold text-[#755D5C] transition-colors hover:bg-white hover:text-[#4A3333]"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Поле вопроса */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(inputVal);
        }}
        className="flex items-center gap-2 rounded-full bg-[#F1EBE9] py-1.5 pl-5 pr-1.5 transition-shadow focus-within:ring-2 focus-within:ring-[#4A3333]/15"
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Спросите про любое утверждение…"
          className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-[#4A3333] outline-none placeholder:text-[#A27C7A]"
        />
        {/* TODO(frontend): голосовой ввод */}
        <button
          type="button"
          title="Голосовой ввод"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[#A27C7A] hover:text-[#4A3333]"
        >
          <Mic className="h-[18px] w-[18px]" />
        </button>
        <button
          type="submit"
          disabled={!inputVal.trim()}
          title="Спросить"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[#4A3333] text-white transition-colors hover:bg-[#362424] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowUp className="h-[18px] w-[18px]" />
        </button>
      </form>

      {/* Answer Popover / Chat Log */}
      {isOpen && chatLog.length > 0 && (
        <div className="absolute bottom-[calc(100%+8px)] right-0 w-full max-h-[320px] bg-white border border-[#E3D9D6] rounded-2xl shadow-xl p-4 overflow-y-auto flex flex-col gap-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-[#E3D9D6]/60">
            <span className="text-xs font-black text-[#4A3333] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Ответ ассистента factholic
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#A27C7A] hover:text-[#4A3333] p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {chatLog.map((entry, i) => (
              <div
                key={i}
                className={`text-xs p-2.5 rounded-xl leading-relaxed ${
                  entry.sender === "user"
                    ? "bg-[#F1EBE9] text-[#4A3333] font-bold self-end ml-6"
                    : "bg-[#F3ECFE] text-[#2A1818] font-medium mr-4 border border-[#D6BFFB]"
                }`}
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
