import React, { useState } from "react";
import type { VideoReport } from "@news/contracts";
import {
  AlertTriangle,
  Flame,
  GitBranch,
  ArrowRight,
  Send,
  Clock,
  Sparkles,
} from "lucide-react";

interface AnalysisScreenProps {
  report: VideoReport;
  selectedClaimId: string;
  onSelectClaimId: (id: string) => void;
  onOpenProvenanceTree: () => void;
  onAskQuestion?: (question: string) => void;
}

export function AnalysisScreen({
  report,
  selectedClaimId,
  onSelectClaimId,
  onOpenProvenanceTree,
  onAskQuestion,
}: AnalysisScreenProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [questionInput, setQuestionInput] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);

  const factChecks = report.factChecks;
  const currentClaim =
    factChecks.find((fc) => fc.id === selectedClaimId) || factChecks[0];

  const summary = report.summary || {
    title: "Позиции источников по 4 утверждениям",
    subtitle: "Общего вердикта нет - смотрите каждое утверждение",
    totalClaims: factChecks.length,
    totalSources: 11,
    consensusBreakdown: {
      converge: 1,
      split: 1,
      against: 1,
      flagged: 1,
    },
    flagBreakdown: {
      exaggerated: 1,
      outdated: 1,
    },
    suggestedQuestions: [
      "Кто первоисточник?",
      "Что исказили?",
      "Когда это было?",
    ],
    footerNote:
      "* Каждое утверждение кликабельно — откроются источники и цепочка пересказов",
  };

  const handleSendQuestion = (q?: string) => {
    const questionText = (q || questionInput).trim();
    if (!questionText) return;

    const userEntry = { sender: "user" as const, text: questionText };
    let aiResponse = "";

    if (questionText.toLowerCase().includes("первоисточник")) {
      aiResponse =
        "Первоисточник — «Новости MD» от 14.03.2023. В исходном материале сообщалось о пожаре на складе рядом с ТЦ (2 пострадавших).";
    } else if (
      questionText.toLowerCase().includes("исказ") ||
      questionText.toLowerCase().includes("разду")
    ) {
      aiResponse =
        "Искажения произошли в два этапа: Telegram-канал «Срочно MD» заменил «склад» на «ТЦ», а канал «Город MD» увеличил число пострадавших с 2 до 200 и выдал событие 3,5-летней давности за вчерашнее.";
    } else if (
      questionText.toLowerCase().includes("когда") ||
      questionText.toLowerCase().includes("дата")
    ) {
      aiResponse =
        "Реальный инцидент произошёл 14 марта 2023 года (3,5 года назад), однако в октябрьском сюжете он был подан как происшествие, случившееся «вчера».";
    } else {
      aiResponse = `По утверждению «${currentClaim.claim}»: первоисточник датирован мартом 2023 года, обнаружено раздувание цифр (2 → 200) и замалчивание реальной даты.`;
    }

    setChatLog((prev) => [...prev, userEntry, { sender: "ai", text: aiResponse }]);
    setQuestionInput("");
    if (onAskQuestion) onAskQuestion(questionText);
  };



  return (
    <div className="w-full flex flex-col gap-5">
      {/* 2-Column Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Full Original Text with highlightable claims */}
        <div className="lg:col-span-7 bg-[#FBF8F7] border border-stone-200/90 rounded-2xl p-6 shadow-sm min-h-[480px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/70 mb-4">
              <span className="text-xs font-bold tracking-wider text-stone-500 uppercase">
                Текст который спросили
              </span>
              <span className="text-xs text-stone-400">
                Нажмите на утверждение для разбора
              </span>
            </div>

            <div className="space-y-3.5 leading-relaxed text-sm text-stone-800">
              <p className="text-stone-600">
                В Кишинёве обсуждают главные городские события.
              </p>

              {/* Claim 1: Fire (Selected by default) */}
              <div
                onClick={() => onSelectClaimId("clm_fire_01")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedClaimId === "clm_fire_01"
                    ? "bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/20 shadow-xs"
                    : "bg-white border-stone-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      Раздуто • 3,5 года
                    </span>
                    <span className="text-xs text-stone-400">02:15</span>
                  </div>
                  <span className="text-xs font-medium text-purple-700">
                    {selectedClaimId === "clm_fire_01" ? "Активно" : "Выбрать"}
                  </span>
                </div>
                <p className="font-semibold text-stone-900">
                  «Вчера сгорел торговый центр, 200 пострадавших...»
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Спасатели продолжают ликвидацию последствий происшествия.
                </p>
              </div>

              {/* Claim 2: Boiling point */}
              <div
                onClick={() => onSelectClaimId("clm_02")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedClaimId === "clm_02"
                    ? "bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/20 shadow-xs"
                    : "bg-white border-stone-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      Большинство против
                    </span>
                    <span className="text-xs text-stone-400">04:50</span>
                  </div>
                  <span className="text-xs font-medium text-purple-700">
                    {selectedClaimId === "clm_02" ? "Активно" : "Выбрать"}
                  </span>
                </div>
                <p className="font-medium text-stone-900">
                  «Вода кипит при ста градусах везде, хоть на море, хоть в горах»
                </p>
              </div>

              {/* Claim 3: Inflation */}
              <div
                onClick={() => onSelectClaimId("clm_03")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedClaimId === "clm_03"
                    ? "bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/20 shadow-xs"
                    : "bg-white border-stone-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Мнения разделились
                    </span>
                    <span className="text-xs text-stone-400">07:00</span>
                  </div>
                  <span className="text-xs font-medium text-purple-700">
                    {selectedClaimId === "clm_03" ? "Активно" : "Выбрать"}
                  </span>
                </div>
                <p className="font-medium text-stone-900">
                  «Инфляция в стране упала до четырёх процентов к началу осени»
                </p>
              </div>

              {/* Claim 4: Bridge */}
              <div
                onClick={() => onSelectClaimId("clm_04")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedClaimId === "clm_04"
                    ? "bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/20 shadow-xs"
                    : "bg-white border-stone-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Сходятся
                    </span>
                    <span className="text-xs text-stone-400">10:10</span>
                  </div>
                  <span className="text-xs font-medium text-purple-700">
                    {selectedClaimId === "clm_04" ? "Активно" : "Выбрать"}
                  </span>
                </div>
                <p className="font-medium text-stone-900">
                  «Новый мост в столице открыли точно в срок в августе»
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200/60 mt-4 flex items-center justify-between text-xs text-stone-500">
            <span>Источник: YouTube видеосюжет</span>
            <span>Длительность: 31:00</span>
          </div>
        </div>

        {/* Right Column: Разбор Panel (Matches screen 1 mockup: lavender-toned card) */}
        <div className="lg:col-span-5 bg-[#E8DCFD] border border-purple-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[480px]">
          <div>
            {/* Header with Title and counts */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
                Разбор
              </h2>
              <div className="flex items-center gap-3 text-xs font-semibold text-stone-700">
                <span>4 утверждения</span>
                <span>•</span>
                <span>11 источников</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
              <button
                onClick={() => setActiveFilter("all")}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                  activeFilter === "all"
                    ? "bg-purple-900 text-white shadow-xs"
                    : "bg-white/70 text-stone-700 hover:bg-white"
                }`}
              >
                Все 4
              </button>
              <button
                onClick={() => setActiveFilter("converge")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === "converge"
                    ? "bg-purple-900 text-white shadow-xs"
                    : "bg-white/70 text-stone-700 hover:bg-white"
                }`}
              >
                Сходятся 1
              </button>
              <button
                onClick={() => setActiveFilter("split")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === "split"
                    ? "bg-purple-900 text-white shadow-xs"
                    : "bg-white/70 text-stone-700 hover:bg-white"
                }`}
              >
                Разделились 1
              </button>
              <button
                onClick={() => setActiveFilter("against")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === "against"
                    ? "bg-purple-900 text-white shadow-xs"
                    : "bg-white/70 text-stone-700 hover:bg-white"
                }`}
              >
                Большинство против 1
              </button>
            </div>

            {/* Warning Badges Pill Row */}
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-200/90 text-rose-900 border border-rose-300">
                <span>~</span> Раздуто 1
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300">
                <Clock className="w-3 h-3 text-amber-700" /> Старый контент 1
              </span>
            </div>

            {/* Distortion Flags Cards */}
            <div className="space-y-2 mb-4">
              <div className="bg-white/90 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    Старый контент: первоисточник от 14.03.2023
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    Событию 3,5 года, в сюжете подано как вчерашнее
                  </div>
                </div>
              </div>

              <div className="bg-white/90 border border-rose-300 rounded-xl p-3 flex items-start gap-2.5 shadow-xs">
                <Flame className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    Раздуто: 2 → 200 пострадавших
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    Число увеличено в 100 раз, место заменено со склада на ТЦ
                  </div>
                </div>
              </div>
            </div>

            {/* Путь утверждения (Mini horizontal chain) */}
            <div className="bg-white/90 border border-purple-200 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-stone-800">
                  Путь утверждения
                </span>
                <span className="text-2xs font-medium text-rose-700 flex items-center gap-1">
                  <span className="w-3 h-0.5 border-t border-dashed border-rose-600" />
                  искажение
                </span>
              </div>

              {/* 4 steps row */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {/* Step 1 */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 flex flex-col justify-between text-left">
                  <span className="font-bold text-2xs text-stone-900 truncate">
                    Новости MD
                  </span>
                  <span className="text-3xs text-stone-500">14.03.2023</span>
                  <span className="text-3xs font-semibold text-emerald-700 mt-1">
                    оригинал
                  </span>
                </div>

                {/* Step 2 */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 flex flex-col justify-between text-left">
                  <span className="font-bold text-2xs text-stone-900 truncate">
                    Портал Х
                  </span>
                  <span className="text-3xs text-stone-500">2023</span>
                  <span className="text-3xs font-medium text-stone-600 mt-1">
                    пересказ
                  </span>
                </div>

                {/* Step 3 */}
                <div className="bg-amber-50/80 border border-dashed border-amber-400 rounded-lg p-2 flex flex-col justify-between text-left">
                  <span className="font-bold text-2xs text-stone-900 truncate">
                    Срочно MD
                  </span>
                  <span className="text-3xs text-stone-500">сен 2026</span>
                  <span className="text-3xs font-semibold text-amber-800 mt-1">
                    склад → ТЦ
                  </span>
                </div>

                {/* Step 4 */}
                <div className="bg-rose-50 border border-dashed border-rose-400 rounded-lg p-2 flex flex-col justify-between text-left">
                  <span className="font-bold text-2xs text-stone-900 truncate">
                    Город MD
                  </span>
                  <span className="text-3xs text-stone-500">окт 2026</span>
                  <span className="text-3xs font-bold text-rose-700 mt-1">
                    2 → 200
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Button to open Provenance Tree (Screen 2) */}
          <div className="mt-4 pt-3 border-t border-purple-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700">
              4 источника в цепочке
            </span>
            <button
              onClick={onOpenProvenanceTree}
              className="text-xs font-bold text-white bg-purple-900 hover:bg-purple-950 px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-purple-300" />
              Открыть дерево источников
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar (Matches Mockup 1 Bottom Panel) */}
      <div className="bg-[#FBF8F7] border border-stone-200/90 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Part: 4 Consensus Cards */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {summary.title}
              </h3>
              <p className="text-xs text-stone-500 mb-4">
                {summary.subtitle}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Converge */}
                <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-stone-900 text-sm">
                      1 Сходятся
                    </span>
                  </div>
                  <div className="text-xs text-stone-500">позиции совпадают</div>
                </div>

                {/* Split */}
                <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-stone-900 text-sm">
                      1 Разделились
                    </span>
                  </div>
                  <div className="text-xs text-stone-500">мнения расходятся</div>
                </div>

                {/* Against */}
                <div className="bg-white border border-red-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="font-bold text-stone-900 text-sm">
                      1 Против
                    </span>
                  </div>
                  <div className="text-xs text-stone-500">источники возражают</div>
                </div>

                {/* Flagged */}
                <div className="bg-white border border-rose-300 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="font-bold text-stone-900 text-sm">
                      1 С флагами
                    </span>
                  </div>
                  <div className="text-xs text-stone-500">раздуто • старое</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-stone-400 mt-4">
              {summary.footerNote}
            </div>
          </div>

          {/* Right Part: AI Assistant & Suggested questions */}
          <div className="lg:col-span-4 bg-stone-100/70 border border-stone-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Спросите у AI
                </span>
                <span className="text-3xs text-stone-400">по источникам</span>
              </div>

              {/* Suggested Questions Chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {summary.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendQuestion(q)}
                    className="text-xs font-medium text-stone-700 bg-white hover:bg-purple-50 hover:text-purple-900 border border-stone-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Chat Log snippet if present */}
              {chatLog.length > 0 && (
                <div className="space-y-2 mb-3 max-h-36 overflow-y-auto pr-1 text-xs">
                  {chatLog.slice(-2).map((item, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg leading-relaxed ${
                        item.sender === "user"
                          ? "bg-purple-100 text-purple-900 font-medium ml-4"
                          : "bg-white text-stone-800 border border-stone-200/80 mr-4"
                      }`}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="relative mt-2">
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendQuestion()}
                placeholder="Спросите про любое утверждение..."
                className="w-full bg-white border border-stone-300 rounded-lg pl-3 pr-8 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition-all"
              />
              <button
                type="button"
                onClick={() => handleSendQuestion()}
                className="absolute right-2 top-2 text-stone-400 hover:text-purple-700"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
