import React, { useState } from "react";
import type { FactCheck } from "@news/contracts";
import { ArrowLeft, Clock, Flame, ExternalLink, PlayCircle } from "lucide-react";

export interface ProvenanceTreeModalProps {
  factCheck: FactCheck;
  onBack: () => void;
}

export function ProvenanceTreeModal({ factCheck, onBack }: ProvenanceTreeModalProps) {
  const tree = factCheck.provenance;
  const edges = tree?.edges || [];

  const [selectedEdgeId, setSelectedEdgeId] = useState<string>(tree?.selectedEdgeId || "edge_srochno_gorod");

  const selectedEdge =
    edges.find((e) => e.id === selectedEdgeId) || edges.find((e) => e.hasDistortion) || edges[0];

  const diff = selectedEdge?.diff;

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Top Bar with Back Button and Claim Header */}
      <div className="bg-[#FBF8F7] border border-[#E3D9D6] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#6D28D9] hover:text-[#4C1D95] bg-[#F3ECFE] hover:bg-[#E8DCFD] px-3.5 py-1.5 rounded-full border border-[#D6BFFB] transition-all w-fit cursor-pointer active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />К разбору
          </button>

          <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-[#755D5C]">
            <span>5 источников</span>
            <span>•</span>
            <span className="text-[#1DA57A] font-extrabold">1 первоисточник</span>
          </div>
        </div>

        {/* Claim Quote */}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#4A3333] tracking-tight mb-3">
          {factCheck.quote}
        </h1>

        {/* Key Finding Banner & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFF8E6] border border-[#FFE4A0] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFC20E] text-[#4A3333] flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              <Clock className="w-5 h-5 text-[#4A3333]" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black text-[#4A3333]">
                {factCheck.keyFinding?.title || "Событию 3,5 года"}
              </div>
              <div className="text-xs sm:text-sm text-[#755D5C] font-semibold">
                {factCheck.keyFinding?.subtitle || "в видео подано как вчерашнее"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full bg-[#FFF8E6] text-[#B88700] border border-[#FFE4A0]">
              <Clock className="w-3.5 h-3.5 text-[#B88700]" />
              Старый контент
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full bg-[#FFEBEB] text-[#D9381E] border border-[#FFAA80]">
              <Flame className="w-3.5 h-3.5 text-[#D9381E]" />
              Раздуто
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Interactive Tree (Left) + Diff Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Left Column: Visual Tree with Timeline and Nodes */}
        <div className="lg:col-span-8 bg-[#FBF8F7] border border-[#E3D9D6] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-6 overflow-x-auto">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#4A3333]">
                Дерево первоисточника и цепочка пересказов
              </span>
              <span className="text-xs text-[#A27C7A] font-semibold">
                Нажмите на связь для сравнения текстов
              </span>
            </div>

            {/* Tree Grid (Columns = Dates) */}
            <div className="grid grid-cols-4 gap-4 relative pt-2 pb-6 min-w-[620px]">
              {/* Column 1: 14 марта 2023 */}
              <div className="flex flex-col gap-5">
                <div className="text-xs font-extrabold text-[#755D5C] text-center pb-2 border-b border-[#E3D9D6]">
                  14 марта 2023
                </div>

                {/* Node: Новости MD (Первоисточник) */}
                <div className="bg-white border-2 border-[#1DA57A] rounded-2xl p-3.5 shadow-xs relative hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-5 rounded bg-[#4A3333] text-white font-extrabold text-[10px] flex items-center justify-center">
                        HM
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1EBE9] text-[#755D5C]">
                        СМИ
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold text-[#1DA57A] bg-[#E6F7F0] px-2 py-0.5 rounded-full">
                      Первоисточник
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-[#4A3333]">Новости MD</h3>
                  <p className="text-[10px] text-[#A27C7A] font-semibold mb-2">• 14 марта 2023</p>
                  <p className="text-xs font-bold text-[#2A1818] leading-tight mb-3">
                    «Пожар на складе рядом с ТЦ, 2 пострадавших»
                  </p>

                  <a
                    href="https://novosti-md.example/fire-warehouse-2023"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] hover:underline"
                  >
                    <span>Открыть источник</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Column 2: март 2023 */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-extrabold text-[#755D5C] text-center pb-2 border-b border-[#E3D9D6]">
                  март 2023
                </div>

                {/* Node: Портал Х */}
                <div
                  onClick={() => setSelectedEdgeId("edge_news_portal")}
                  className={`bg-white border rounded-2xl p-3.5 shadow-xs relative hover:border-[#8B5CF6] transition-all cursor-pointer ${
                    selectedEdgeId === "edge_news_portal"
                      ? "border-[#8B5CF6] ring-2 ring-[#8B5CF6]/20"
                      : "border-[#E3D9D6]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1EBE9] text-[#755D5C]">
                        СМИ
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-[#755D5C] bg-[#F1EBE9] px-1.5 py-0.5 rounded-full">
                      пересказ без изменений
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-[#4A3333]">Портал Х</h3>
                  <p className="text-[10px] text-[#A27C7A] font-semibold mb-2">• март 2023</p>
                  <p className="text-xs font-bold text-[#2A1818] leading-tight mb-3">
                    «Пожар на складе рядом с ТЦ, двое пострадавших»
                  </p>

                  <a
                    href="https://portal-x.example/fire-warehouse"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] hover:underline"
                  >
                    <span>Открыть источник</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Node: Мэрия Кишинёва */}
                <div className="bg-white border border-[#E3D9D6] rounded-2xl p-3.5 shadow-xs relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-5 rounded bg-[#1DA57A] text-white font-extrabold text-[10px] flex items-center justify-center">
                        MK
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E6F7F0] text-[#1DA57A]">
                        официальный
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs font-black text-[#4A3333]">Мэрия Кишинёва</h3>
                  <p className="text-[10px] text-[#A27C7A] font-semibold mb-1">• 15.03.2023</p>
                  <p className="text-[10px] font-bold text-[#1DA57A] mb-1">подтверждает: 2 пострадавших</p>
                  <p className="text-xs font-bold text-[#2A1818] leading-tight mb-2">
                    «На складе пострадали 2 человека»
                  </p>
                  <a
                    href="https://chisinau.md/press/warehouse-incident"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] hover:underline"
                  >
                    <span>Открыть источник</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Column 3: сентябрь 2026 */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-extrabold text-[#755D5C] text-center pb-2 border-b border-[#E3D9D6]">
                  сентябрь 2026
                </div>

                {/* Node: Срочно MD */}
                <div
                  onClick={() => setSelectedEdgeId("edge_srochno_gorod")}
                  className={`bg-white border rounded-2xl p-3.5 shadow-xs relative hover:border-[#8B5CF6] transition-all cursor-pointer ${
                    selectedEdgeId === "edge_srochno_gorod"
                      ? "border-[#8B5CF6] ring-2 ring-[#8B5CF6]/20 bg-[#FAF7FE]/50"
                      : "border-[#E3D9D6]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-5 rounded bg-[#4A3333] text-white font-extrabold text-[10px] flex items-center justify-center">
                        CM
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1EBE9] text-[#755D5C]">
                        официальный
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs font-black text-[#4A3333]">Срочно MD</h3>
                  <p className="text-[10px] text-[#A27C7A] font-semibold mb-1">• сентябрь 2026</p>

                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-[10px] font-black text-[#B88700] bg-[#FFF8E6] px-1.5 py-0.5 rounded">
                      @ дата убрана
                    </span>
                    <span className="text-[10px] font-black text-[#D9381E] bg-[#FFEBEB] px-1.5 py-0.5 rounded">
                      ✂ склад → ТЦ
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#2A1818] leading-tight mb-3">
                    «Сгорел ТЦ рядом с рынком, 2 пострадавших»
                  </p>

                  <a
                    href="https://t.me/srochno_md/4921"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] hover:underline"
                  >
                    <span>Открыть источник</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Column 4: октябрь 2026 */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-extrabold text-[#755D5C] text-center pb-2 border-b border-[#E3D9D6]">
                  октябрь 2026 • 02:15
                </div>

                {/* Node: Город MD (в сюжете) */}
                <div
                  onClick={() => setSelectedEdgeId("edge_srochno_gorod")}
                  className={`bg-white border-2 rounded-2xl p-3.5 shadow-xs relative hover:border-[#D9381E] transition-all cursor-pointer ${
                    selectedEdgeId === "edge_srochno_gorod"
                      ? "border-[#D9381E] ring-2 ring-[#D9381E]/20 bg-[#FFF5F5]/60"
                      : "border-[#FFAA80]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-5 rounded bg-[#D9381E] text-white font-extrabold text-[10px] flex items-center justify-center">
                        ГМ
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFEBEB] text-[#D9381E]">
                        в сюжете
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs font-black text-[#4A3333]">Город MD</h3>
                  <p className="text-[10px] text-[#A27C7A] font-semibold mb-1">• октябрь 2026 • 02:15</p>

                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-[10px] font-black text-[#D9381E] bg-[#FFEBEB] px-1.5 py-0.5 rounded">
                      @ вчера
                    </span>
                    <span className="text-[10px] font-black text-[#D9381E] bg-[#FFEBEB] px-1.5 py-0.5 rounded">
                      2 2 → 200
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#2A1818] leading-tight mb-3">
                    «Вчера сгорел торговый центр, 200 пострадавших»
                  </p>

                  <a
                    href="https://www.youtube.com/watch?v=MOCK123&t=135"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6D28D9] hover:underline"
                  >
                    <PlayCircle className="w-3 h-3 text-[#D9381E]" />
                    <span>Смотреть фрагмент</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Timeline Axis */}
            <div className="mt-3 pt-3 border-t border-[#E3D9D6] relative">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-[#A27C7A]">
                <span>14 марта 2023</span>
                <span>март 2023</span>
                <span className="text-[#D9381E] font-black bg-[#FFEBEB] px-2.5 py-0.5 rounded-full border border-[#FFAA80]">
                  ⚡️ 3,5 года тишины
                </span>
                <span>сентябрь 2026</span>
                <span>октябрь 2026</span>
              </div>
            </div>
          </div>

          {/* Footer Legend ("Как читать") */}
          <div className="pt-3 border-t border-[#E3D9D6]/80 flex flex-wrap items-center justify-between text-xs text-[#755D5C] gap-3">
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
              <span className="text-[#4A3333] font-black">Как читать:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#4A3333] inline-block" />
                прямая связь
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-b-2 border-dashed border-[#A27C7A] inline-block" />
                вероятно взято отсюда
              </span>
              <span className="flex items-center gap-1.5 text-[#D9381E]">
                <span className="w-4 h-0.5 bg-[#D9381E] inline-block" />
                искажение
              </span>
              <span className="flex items-center gap-1.5 text-[#1DA57A]">
                <span className="w-2 h-2 rounded-full bg-[#1DA57A] inline-block" />
                первоисточник
              </span>
            </div>

            <span className="text-[11px] font-extrabold text-[#6D28D9] flex items-center gap-1">
              👆 нажми на связь
            </span>
          </div>
        </div>

        {/* Right Column: Diff & Changes Panel */}
        <div className="lg:col-span-4 bg-[#FBF8F7] border border-[#E3D9D6] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-wider text-[#A27C7A]">
              Связь между источниками
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#4A3333]">
              {diff ? `${diff.before.sourceName} → ${diff.after.sourceName}` : "Срочно MD → Город MD"}
            </h2>
            <p className="text-xs text-[#755D5C] font-semibold">
              {selectedEdge?.label || "сен 2026 → окт 2026 • пересказ с изменениями"}
            </p>
          </div>

          {/* Text Comparison Box (Было / Стало) */}
          <div className="space-y-3">
            {/* БЫЛО */}
            <div className="p-3.5 rounded-xl bg-white border border-[#E3D9D6] space-y-1">
              <div className="text-[11px] font-black text-[#755D5C] uppercase tracking-wide">
                БЫЛО • {diff?.before.sourceName || "Срочно MD"}
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#2A1818] leading-relaxed">
                {diff?.before.text || "Сгорел ТЦ рядом с рынком, 2 пострадавших"}
              </p>
            </div>

            {/* СТАЛО */}
            <div className="p-3.5 rounded-xl bg-[#FFF5F5] border border-[#FFAA80] space-y-1">
              <div className="text-[11px] font-black text-[#D9381E] uppercase tracking-wide">
                СТАЛО • {diff?.after.sourceName || "Город MD, 02:15"}
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#2A1818] leading-relaxed">
                Вчера сгорел торговый центр,{" "}
                <span className="bg-[#FFEBEB] text-[#D9381E] font-black px-1.5 py-0.5 rounded border border-[#FFAA80]">
                  200
                </span>{" "}
                пострадавших
              </p>
            </div>
          </div>

          {/* What Changed Section */}
          <div className="pt-2 border-t border-[#E3D9D6] space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-[#4A3333]">Что изменилось</div>

            <div className="space-y-2.5">
              {diff?.changes && diff.changes.length > 0 ? (
                diff.changes.map((ch, idx) => (
                  <div key={idx} className="text-xs space-y-0.5">
                    <span className="font-black text-[#4A3333]">{ch.categoryLabel}:</span>{" "}
                    <span className="font-semibold text-[#755D5C]">{ch.description}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="text-xs space-y-0.5">
                    <span className="font-black text-[#D9381E]">Цифры:</span>{" "}
                    <span className="font-semibold text-[#755D5C]">«2» → «200», в 100 раз больше</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <span className="font-black text-[#4A3333]">Место:</span>{" "}
                    <span className="font-semibold text-[#755D5C]">«рядом с рынком» — убрано</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <span className="font-black text-[#4A3333]">Время:</span>{" "}
                    <span className="font-semibold text-[#755D5C]">даты не было → «вчера»</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <span className="font-black text-[#4A3333]">Уверенность:</span>{" "}
                    <span className="font-semibold text-[#755D5C]">подано от себя, без ссылки на канал</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
