import React, { useState } from "react";
import type { VideoReport } from "@news/contracts";
import { VerificationHeader } from "./VerificationHeader";
import { ClaimTextPanel } from "./ClaimTextPanel";
import { AnalysisCard } from "./AnalysisCard";
import { ConsensusBar } from "./ConsensusBar";
import { TreeView } from "./TreeView";
import { countFilters, matchesFilter, type ClaimFilter } from "./filters";
import { materialKind } from "./material";

export type VerificationView = "analysis" | "tree";

export interface VerificationScreenProps {
  report: VideoReport;
  /** Вид экрана. Если задан вместе с onViewChange — управляется снаружи (например, через ?view=tree в адресе) */
  view?: VerificationView;
  onViewChange?: (view: VerificationView) => void;
  onGoHome?: () => void;
}

/**
 * Экран разбора по макету.
 * lg+: ровно в высоту окна, страница не прокручивается — длинный текст и детали прокручиваются внутри карточек.
 *   слева: «Текст который спросили» (растягивается) + плашка позиций источников;
 *   справа: «Разбор» во всю высоту, внизу — вопросы ассистенту.
 * Мобильные: всё в одну колонку с обычной прокруткой.
 */
export function VerificationScreen({ report, view, onViewChange, onGoHome }: VerificationScreenProps) {
  const factChecks = report.factChecks;
  const [selectedClaimId, setSelectedClaimId] = useState<string>(factChecks[0]?.id ?? "");
  const [activeFilter, setActiveFilter] = useState<ClaimFilter>("all");
  const [localView, setLocalView] = useState<VerificationView>(view ?? "analysis");
  const isTreeView = (onViewChange ? view : localView) === "tree";
  const setView = (v: VerificationView) => (onViewChange ? onViewChange(v) : setLocalView(v));

  const counts = countFilters(factChecks);
  const currentClaim = factChecks.find((fc) => fc.id === selectedClaimId) ?? factChecks[0];

  const changeFilter = (filter: ClaimFilter) => {
    setActiveFilter(filter);
    // выбранное утверждение не подходит под фильтр — переключаемся на первое подходящее
    if (currentClaim && !matchesFilter(currentClaim, filter)) {
      const first = factChecks.find((fc) => matchesFilter(fc, filter));
      if (first) setSelectedClaimId(first.id);
    }
  };

  const totalSources =
    report.summary?.totalSources ?? new Set(factChecks.flatMap((fc) => fc.sources.map((s) => s.url))).size;

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#F1EBE9] font-sans text-[#4A3333] lg:h-[100svh] lg:overflow-hidden">
      <VerificationHeader onGoHome={onGoHome} />

      {isTreeView && currentClaim ? (
        // lg+: колонка во всю высоту экрана, прокрутка — внутри холста и панели дерева; мобильные — обычная прокрутка
        <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-y-auto px-4 pb-5 sm:px-8 lg:overflow-hidden">
          <TreeView
            factCheck={currentClaim}
            material={materialKind(report.video)}
            onBack={() => setView("analysis")}
          />
        </main>
      ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pb-5 pt-1 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(380px,35.6vw,456px)] lg:gap-8 lg:pb-8">
          <div className="flex min-h-0 flex-col gap-5 lg:gap-[22px]">
            <ClaimTextPanel
              factChecks={factChecks}
              selectedClaimId={currentClaim?.id ?? ""}
              onSelectClaimId={setSelectedClaimId}
              isDimmed={(fc) => !matchesFilter(fc, activeFilter)}
            />
            <ConsensusBar counts={counts} activeFilter={activeFilter} onSelectFilter={changeFilter} />
          </div>

          <AnalysisCard
            jobId={report.jobId}
            factCheck={currentClaim}
            totalClaims={report.summary?.totalClaims ?? factChecks.length}
            totalSources={totalSources}
            counts={counts}
            activeFilter={activeFilter}
            onFilterChange={changeFilter}
            onOpenProvenanceTree={() => setView("tree")}
            suggestedQuestions={report.summary?.suggestedQuestions}
            material={materialKind(report.video)}
          />
        </main>
      )}
    </div>
  );
}
