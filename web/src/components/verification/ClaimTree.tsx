"use client";

/**
 * Дерево утверждения на сайте и в видео кабинета — тот же холст, что на экране проверки кабинета:
 * двигается, масштабируется, узлы перетаскиваются. Дерево в проекте одно.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FactCheck, JobId } from "@news/contracts";
import { ArrowLeft, History, Search, TrendingUp } from "lucide-react";
import type { PluralForms } from "../../i18n/locale";
import { useSiteText } from "../../i18n/site";
import { useCabinetText } from "../cabinet/dictionary";
import { toClaimCanvas } from "../cabinet/live-map";
import { TreeCanvas } from "../cabinet/TreeCanvas";
import { requestMoreSearch } from "../../lib/jobs";
import { hasProvenanceTree, publicationNodes } from "./material";

const NO_FOCUS: string[] = [];
/** Ответа нет так долго: кнопка снова доступна */
const MORE_TIMEOUT_MS = 5 * 60 * 1000;

/** «Найти ещё»: новый итог приходит тем же утверждением, поэтому ждём смены объекта */
function useFindMore(jobId: JobId, factCheck: FactCheck) {
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<number>();
  const before = useRef<{ factCheck: FactCheck; count: number } | null>(null);
  useEffect(() => {
    const started = before.current;
    if (!started || started.factCheck === factCheck) return;
    before.current = null;
    setSearching(false);
    setFound(Math.max(0, publicationNodes(factCheck.provenance).length - started.count));
  }, [factCheck]);
  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(() => setSearching(false), MORE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [searching]);
  const start = async () => {
    before.current = { factCheck, count: publicationNodes(factCheck.provenance).length };
    setSearching(true);
    if (await requestMoreSearch(jobId, factCheck.id)) return;
    before.current = null;
    setSearching(false);
  };
  return { searching, found, start };
}

export function ClaimTree({
  jobId,
  factCheck,
  onBack,
}: {
  jobId: JobId;
  factCheck: FactCheck;
  onBack?: () => void;
}) {
  const t = useSiteText();
  const cabinetText = useCabinetText();
  const canvas = useMemo(() => toClaimCanvas(factCheck, cabinetText), [factCheck, cabinetText]);
  const more = useFindMore(jobId, factCheck);
  const canFindMore = factCheck.status === "done" || factCheck.status === "failed";
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const flags = factCheck.flags.filter(
    (flag, index, all) => all.findIndex((item) => item.type === flag.type) === index,
  );

  return (
    <div className="flex min-h-0 flex-col gap-4 text-[#4A3333] lg:flex-1">
      {/* поверх холста: карточки уходят под текст, а перетаскивать холст сквозь него можно */}
      <div className="pointer-events-none relative z-10 flex shrink-0 flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border-2 border-[#4A3333] bg-[#F1EBE9] px-4 py-1.5 text-[15px] font-extrabold text-[#4A3333] transition-colors hover:bg-[#4A3333] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.tree.back}
          </button>
          {canFindMore && (
            <button
              type="button"
              onClick={() => void more.start()}
              disabled={more.searching}
              aria-busy={more.searching}
              className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full bg-[#4A3333] px-4 py-2 text-[14px] font-extrabold text-white disabled:cursor-default disabled:opacity-70"
            >
              <Search className={`h-4 w-4 ${more.searching ? "animate-pulse" : ""}`} />
              {more.searching ? t.tree.findingMore : t.tree.findMore}
            </button>
          )}
          {!more.searching && more.found !== undefined && (
            <span className="text-[14px] font-bold text-[#A27C7A]">
              {more.found > 0 ? t.tree.moreFound(more.found) : t.tree.moreNothing}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="m-0 text-[22px] font-black leading-tight tracking-[-0.5px] sm:text-[26px]">
            {factCheck.quote}
          </h1>
          {flags.map((flag) => {
            const outdated = flag.type === "outdated";
            const Icon = outdated ? History : TrendingUp;
            return (
              <span
                key={flag.type}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-extrabold ${
                  outdated ? "bg-[#E8DCFD] text-[#6E1EF0]" : "bg-[#FFE7D3] text-[#FF7A12]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {flag.label}
              </span>
            );
          })}
        </div>
        {hasProvenanceTree(factCheck.provenance) && (
          <p className="m-0 text-[14px] font-bold text-[#A27C7A]">
            {[
              [canvas.stats.publications, cabinetText.canvas.publications],
              [canvas.stats.links ?? 0, cabinetText.canvas.links],
              [canvas.stats.changes ?? 0, cabinetText.canvas.changes],
            ]
              .map(([count, word]) => `${count} ${cabinetText.plural(count as number, word as PluralForms)}`)
              .join(" · ")}
          </p>
        )}
      </div>

      {hasProvenanceTree(factCheck.provenance) ? (
        <div className="relative flex h-[70svh] min-h-0 lg:h-auto lg:flex-1">
          <TreeCanvas
            check={canvas}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              if (id) setSelectedEdgeId(undefined);
            }}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              if (id) setSelectedNodeId(undefined);
            }}
            highlightAlert={false}
            focusIds={NO_FOCUS}
            searchOpen={false}
            bare
          />
        </div>
      ) : (
        <div className="rounded-[28px] bg-[#FBF8F7] p-8 text-[15px] font-semibold text-[#A27C7A]">
          {publicationNodes(factCheck.provenance).length > 0 ? t.tree.noTreeOffTopic : t.tree.noTree}
        </div>
      )}
    </div>
  );
}
