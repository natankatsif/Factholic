import React, { useState } from "react";
import type { FactCheck } from "@news/contracts";
import {
  ArrowLeft,
  Clock,
  Flame,
  ExternalLink,
  PlayCircle,
} from "lucide-react";

interface ProvenanceTreeScreenProps {
  factCheck: FactCheck;
  onBack: () => void;
}

export function ProvenanceTreeScreen({
  factCheck,
  onBack,
}: ProvenanceTreeScreenProps) {
  const tree = factCheck.provenance;
  const edges = tree?.edges || [];

  const [selectedEdgeId, setSelectedEdgeId] = useState<string>(
    tree?.selectedEdgeId || "edge_srochno_gorod",
  );

  const selectedEdge =
    edges.find((e) => e.id === selectedEdgeId) ||
    edges.find((e) => e.hasDistortion) ||
    edges[0];

  const diff = selectedEdge?.diff;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Bar with Back Button and Claim Header */}
      <div className="bg-[#FBF8F7] border border-stone-200/90 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 bg-purple-100 hover:bg-purple-200/80 px-3 py-1.5 rounded-lg transition-colors w-fit cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            К разбору
          </button>

          <div className="flex items-center gap-4 text-xs font-semibold text-stone-600">
            <span>5 источников</span>
            <span>•</span>
            <span className="text-emerald-700">1 первоисточник</span>
          </div>
        </div>

        {/* Claim Quote */}
        <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight mb-3">
          {factCheck.quote}
        </h1>

        {/* Finding Banner & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-900">
                {factCheck.keyFinding?.title || "Событию 3,5 года"}
              </div>
              <div className="text-xs text-stone-600">
                {factCheck.keyFinding?.subtitle || "в сюжете подано как вчерашнее"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              Старый контент
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              Раздуто
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Interactive Tree (Left) + Diff Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Visual Tree with Timeline and Nodes */}
        <div className="lg:col-span-8 bg-[#FBF8F7] border border-stone-200/90 rounded-2xl p-5 shadow-sm min-h-[580px] flex flex-col justify-between overflow-x-auto">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Дерево первоисточника и цепочка пересказов
              </span>
              <span className="text-xs text-stone-400">
                Нажмите на связь для сравнения текстов
              </span>
            </div>

            {/* Tree Grid (Columns = Dates) */}
            <div className="grid grid-cols-4 gap-4 relative pt-2 pb-6 min-w-[620px]">
              {/* Column 0: 14 марта 2023 */}
              <div className="flex flex-col gap-6">
                <div className="text-xs font-bold text-stone-700 text-center pb-2 border-b border-stone-200">
                  14 марта 2023
                </div>

                {/* Node: Новости MD */}
                <div className="bg-white border-2 border-stone-300 rounded-xl p-3 shadow-xs relative hover:border-purple-500 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-5 rounded bg-stone-900 text-white font-bold text-3xs flex items-center justify-center">
                        HM
                      </span>
                      <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                        СМИ
                      </span>
                    </div>
                    <span className="text-3xs font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      ★ Первоисточник
                    </span>
                  </div>

                  <div className="font-bold text-xs text-stone-900">
                    Новости MD
                  </div>
                  <div className="text-3xs text-stone-400 mb-1.5">
                    14 марта 2023
                  </div>

                  <div className="text-xs text-stone-700 italic bg-stone-50 p-2 rounded-lg border border-stone-100 mb-2">
                    «Пожар на складе рядом с ТЦ, 2 пострадавших»
                  </div>

                  <a
                    href="https://novosti-md.example/fire-warehouse-2023"
                    target="_blank"
                    rel="noreferrer"
                    className="text-3xs font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    Открыть источник <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Column 1: март 2023 (Portal X & City Hall) */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-bold text-stone-700 text-center pb-2 border-b border-stone-200">
                  март 2023
                </div>

                {/* Node: Портал Х */}
                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs hover:border-purple-400 transition-all">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                      СМИ
                    </span>
                  </div>

                  <div className="font-bold text-xs text-stone-900">
                    Портал Х
                  </div>
                  <div className="text-3xs text-stone-400 mb-1.5">
                    март 2023
                  </div>

                  <div className="text-xs text-stone-700 italic bg-stone-50 p-2 rounded-lg border border-stone-100 mb-2">
                    «Пожар на складе рядом с ТЦ, двое пострадавших»
                  </div>

                  <a
                    href="https://portal-x.example/fire-warehouse"
                    target="_blank"
                    rel="noreferrer"
                    className="text-3xs font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    Открыть источник <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>

                {/* Node: Мэрия Кишинёва */}
                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs hover:border-purple-400 transition-all mt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-6 h-5 rounded bg-blue-700 text-white font-bold text-3xs flex items-center justify-center">
                      MK
                    </span>
                    <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">
                      официальный
                    </span>
                  </div>

                  <div className="font-bold text-xs text-stone-900">
                    Мэрия Кишинёва
                  </div>
                  <div className="text-3xs text-stone-400 mb-1.5">15.03.2023</div>

                  <div className="text-xs text-stone-700 italic bg-stone-50 p-2 rounded-lg border border-stone-100 mb-2">
                    «На складе пострадали 2 человека»
                  </div>

                  <a
                    href="https://chisinau.md/press/warehouse-incident"
                    target="_blank"
                    rel="noreferrer"
                    className="text-3xs font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    Открыть источник <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Column 2: сентябрь 2026 (Срочно MD) */}
              <div className="flex flex-col gap-6 relative">
                <div className="text-xs font-bold text-stone-700 text-center pb-2 border-b border-stone-200">
                  сентябрь 2026
                </div>

                {/* Node: Срочно MD */}
                <div className="bg-white border-2 border-amber-300 rounded-xl p-3 shadow-xs hover:border-amber-500 transition-all">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-6 h-5 rounded bg-amber-600 text-white font-bold text-3xs flex items-center justify-center">
                      CM
                    </span>
                    <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">
                      официальный
                    </span>
                  </div>

                  <div className="font-bold text-xs text-stone-900">
                    Срочно MD
                  </div>
                  <div className="text-3xs text-stone-400 mb-1.5">
                    сентябрь 2026
                  </div>

                  <div className="text-xs text-stone-700 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100 mb-2">
                    «Сгорел ТЦ рядом с рынком, 2 пострадавших»
                  </div>

                  {/* Distortion badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-3xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                      @ дата убрана
                    </span>
                    <span className="text-3xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">
                      ✂ склад → ТЦ
                    </span>
                  </div>

                  <a
                    href="https://t.me/srochno_md/4921"
                    target="_blank"
                    rel="noreferrer"
                    className="text-3xs font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    Открыть источник <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Column 3: октябрь 2026 (Город MD) */}
              <div className="flex flex-col gap-6">
                <div className="text-xs font-bold text-stone-700 text-center pb-2 border-b border-stone-200">
                  октябрь 2026
                </div>

                {/* Node: Город MD */}
                <div className="bg-white border-2 border-rose-400 rounded-xl p-3 shadow-xs hover:border-rose-600 transition-all">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-6 h-5 rounded bg-rose-700 text-white font-bold text-3xs flex items-center justify-center">
                      ГМ
                    </span>
                    <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800">
                      официальный
                    </span>
                  </div>

                  <div className="font-bold text-xs text-stone-900">
                    Город MD
                  </div>
                  <div className="text-3xs text-stone-400 mb-1.5">
                    октябрь 2026 • 02:15
                  </div>

                  <div className="text-xs text-stone-900 font-medium bg-rose-50/70 p-2 rounded-lg border border-rose-200 mb-2">
                    «Вчера сгорел торговый центр, 200 пострадавших»
                  </div>

                  {/* Distortion badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-3xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                      @ вчера
                    </span>
                    <span className="text-3xs px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-extrabold">
                      ⚡ 2 → 200
                    </span>
                  </div>

                  <div className="text-3xs font-semibold text-purple-800 flex items-center gap-1 cursor-pointer">
                    <PlayCircle className="w-3 h-3 text-purple-600" />
                    Смотреть фрагмент ↗
                  </div>
                </div>
              </div>
            </div>

            {/* Gap Alert / Timeline Break Bar */}
            <div className="my-3 py-2 px-4 rounded-xl bg-purple-50/80 border border-purple-200/90 flex items-center justify-between text-xs text-purple-900">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                <span className="font-bold">Временной разрыв: 3,5 года тишины</span>
                <span className="text-purple-700 hidden sm:inline">
                  (с марта 2023 по сентябрь 2026 публикации отсутствовали)
                </span>
              </div>
              <span className="text-2xs bg-purple-200/70 text-purple-800 font-semibold px-2 py-0.5 rounded">
                Флаг: старый контент
              </span>
            </div>

            {/* Edges Selector Buttons */}
            <div className="pt-2 border-t border-stone-200">
              <div className="text-2xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Связи между источниками:
              </div>
              <div className="flex flex-wrap gap-2">
                {edges.map((edge) => {
                  const isSelected = edge.id === selectedEdgeId;
                  return (
                    <button
                      key={edge.id}
                      onClick={() => setSelectedEdgeId(edge.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-purple-900 text-white border-purple-950 shadow-xs font-semibold"
                          : edge.hasDistortion
                            ? "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
                            : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      {edge.hasDistortion && (
                        <Flame className="w-3 h-3 text-rose-500" />
                      )}
                      <span>{edge.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Legend ("Как читать") */}
          <div className="mt-4 pt-3 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-stone-700">Как читать:</span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-stone-400" /> прямая связь
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 border-t border-dashed border-stone-400" />
                вероятно взято отсюда
              </span>
              <span className="flex items-center gap-1 text-rose-700 font-medium">
                <span className="w-4 h-0.5 bg-rose-500" /> искажение
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                ★ первоисточник
              </span>
            </div>
            <div className="text-purple-700 font-medium text-2xs">
              нажми на связь для сравнения
            </div>
          </div>
        </div>

        {/* Right Column: Diff Panel ("Связь между источниками") */}
        <div className="lg:col-span-4 bg-[#FBF8F7] border border-stone-200/90 rounded-2xl p-5 shadow-sm min-h-[580px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 mb-3">
              <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
                Связь между источниками
              </h2>
              {selectedEdge?.hasDistortion && (
                <span className="text-3xs font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  Искажение
                </span>
              )}
            </div>

            {/* Source Pair Title */}
            <div className="mb-4">
              <div className="text-sm font-bold text-stone-900">
                {diff?.before.sourceName || "Срочно MD"} →{" "}
                {diff?.after.sourceName || "Город MD"}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                {selectedEdge?.label || "пересказ с изменениями"}
              </div>
            </div>

            {/* Было / Стало Cards */}
            <div className="space-y-3 mb-5">
              {/* БЫЛО */}
              <div className="bg-stone-100/90 border border-stone-200 rounded-xl p-3.5">
                <div className="text-3xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Было • {diff?.before.sourceName || "Срочно MD"}
                </div>
                <div className="text-xs text-stone-800 leading-relaxed font-medium">
                  {diff?.before.text || "Сгорел ТЦ рядом с рынком, 2 пострадавших"}
                </div>
              </div>

              {/* СТАЛО */}
              <div className="bg-rose-50/90 border border-rose-200 rounded-xl p-3.5">
                <div className="text-3xs font-bold text-rose-700 uppercase tracking-wider mb-1">
                  Стало • {diff?.after.sourceName || "Город MD, 02:15"}
                </div>
                <div className="text-xs text-stone-900 leading-relaxed font-semibold">
                  Вчера сгорел торговый центр,{" "}
                  <span className="bg-rose-200 text-rose-900 px-1 py-0.5 rounded font-extrabold">
                    200
                  </span>{" "}
                  пострадавших
                </div>
              </div>
            </div>

            {/* Что изменилось List */}
            <div>
              <div className="text-xs font-bold text-stone-900 mb-2.5">
                Что изменилось:
              </div>

              <div className="space-y-2">
                {diff?.changes && diff.changes.length > 0 ? (
                  diff.changes.map((ch, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-stone-200 rounded-xl p-2.5 shadow-2xs"
                    >
                      <div className="text-2xs font-extrabold text-purple-900 uppercase tracking-wide">
                        {ch.categoryLabel}
                      </div>
                      <div className="text-xs text-stone-700 font-medium mt-0.5">
                        {ch.description}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-2">
                    <div className="bg-white border border-stone-200 rounded-xl p-2.5">
                      <div className="text-2xs font-bold text-purple-900">
                        Цифры
                      </div>
                      <div className="text-xs text-stone-700 mt-0.5">
                        «2» → «200», в 100 раз больше
                      </div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-2.5">
                      <div className="text-2xs font-bold text-purple-900">
                        Место
                      </div>
                      <div className="text-xs text-stone-700 mt-0.5">
                        «рядом с рынком» — убрано
                      </div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-2.5">
                      <div className="text-2xs font-bold text-purple-900">
                        Время
                      </div>
                      <div className="text-xs text-stone-700 mt-0.5">
                        даты не было → «вчера»
                      </div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-2.5">
                      <div className="text-2xs font-bold text-purple-900">
                        Уверенность
                      </div>
                      <div className="text-xs text-stone-700 mt-0.5">
                        подано от себя, без ссылки на первоисточник
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-200/80 text-3xs text-stone-400">
            Оценка достоверности: выявлена манипуляция с устаревшим контентом и искажением данных
          </div>
        </div>
      </div>
    </div>
  );
}
