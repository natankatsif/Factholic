/** Панели поверх холста: переключатель вида, счётчики, легенда и масштаб */
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { pluralWord, useCabinetText } from "./dictionary";
import {
  CaretDownIcon,
  CheckCircleIcon,
  ClockIcon,
  FitViewIcon,
  MinusIcon,
  PlusIcon,
  TreeIcon,
} from "./icons";
import type { CheckStats, CheckStatus } from "./types";

const FLOATING = "bg-card outline outline-2 -outline-offset-1 outline-border rounded-full";

/** Сетка холста: точка 2×2 каждые 28 px, сдвигается и масштабируется вместе с деревом */
const GRID_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect x='14' y='14' width='2' height='2' fill='%23e3d9d6'/%3E%3C/svg%3E\")";
const GRID_STEP = 28;

export function gridStyle(x = 0, y = 0, scale = 1) {
  return {
    backgroundImage: GRID_TILE,
    backgroundSize: `${GRID_STEP * scale}px ${GRID_STEP * scale}px`,
    backgroundPosition: `${x}px ${y}px`,
  };
}

function Stat({
  value,
  label,
  valueClassName,
}: {
  value: string | number;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className={cn("whitespace-nowrap text-[20px] font-black", valueClassName)}>{value}</span>
      <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">{label}</span>
    </div>
  );
}

function CheckStatsRow({ stats, status }: { stats: CheckStats; status: CheckStatus }) {
  const t = useCabinetText();
  const { publications, links, confirmedLinks, changes, traces, growth } = stats;
  const publicationForms = status === "done" ? t.canvas.publications : t.canvas.publicationsFound;
  return (
    <div className="flex items-center gap-[18px]">
      <Stat value={publications} label={pluralWord(publications, publicationForms)} />
      {links !== undefined && <Stat value={links} label={pluralWord(links, t.canvas.links)} />}
      {confirmedLinks !== undefined && (
        <Stat value={confirmedLinks} label={pluralWord(confirmedLinks, t.canvas.confirmedLinks)} />
      )}
      {changes !== undefined && (
        <Stat
          value={changes}
          label={pluralWord(changes, t.canvas.changes)}
          valueClassName="text-cabinet-inflated-text"
        />
      )}
      {traces !== undefined && <Stat value={traces} label={pluralWord(traces, t.canvas.traces)} />}
      {growth !== undefined && (
        <Stat value={t.canvas.growth(growth)} label={t.canvas.perDay} valueClassName="text-cabinet-new" />
      )}
    </div>
  );
}

export function CanvasToolbar({
  stats,
  status,
  onToggleSearch,
}: {
  stats?: CheckStats;
  status?: CheckStatus;
  onToggleSearch?: () => void;
}) {
  const t = useCabinetText();
  return (
    <div className="pointer-events-none absolute left-6 right-6 top-5 z-10 flex items-center justify-between">
      <div className="pointer-events-auto flex items-center gap-2">
        <div className={cn("flex gap-0.5 p-1", FLOATING)}>
          <div className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-extrabold text-white">
            <TreeIcon className="h-[15px] w-[15px]" />
            {t.canvas.tree}
          </div>
          {/* Экрана хронологии в дизайне нет: переключатель показан, но не работает */}
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold text-cabinet-ink-mid"
          >
            <ClockIcon className="h-[15px] w-[15px]" />
            {t.canvas.timeline}
          </button>
        </div>
        {status === "done" && (
          <button
            type="button"
            onClick={onToggleSearch}
            className={cn("flex items-center gap-1.5 px-3.5 py-[9px] text-[13px] font-extrabold", FLOATING)}
          >
            <CheckCircleIcon className="h-4 w-4 text-cabinet-agree" />
            {t.canvas.searchDone}
            <CaretDownIcon className="h-[15px] w-[15px] text-cabinet-ink-mid" />
          </button>
        )}
      </div>
      {stats && status && <CheckStatsRow stats={stats} status={status} />}
    </div>
  );
}

function Legend() {
  const t = useCabinetText();
  const label = "whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid";
  return (
    <div className={cn("pointer-events-auto flex items-center gap-4 px-4 py-2", FLOATING)}>
      <div className="flex items-center gap-[7px]">
        <span className="h-[3px] w-[26px] rounded-sm bg-cabinet-ink-mid" />
        <span className={label}>{t.canvas.legendConfirmed}</span>
      </div>
      <div className="flex items-center gap-[7px]">
        <span className="flex gap-[3px]">
          {[0, 1, 2, 3].map((dash) => (
            <span key={dash} className="h-[3px] w-[5px] rounded-sm bg-cabinet-ink-mid" />
          ))}
        </span>
        <span className={label}>{t.canvas.legendProbable}</span>
      </div>
      <div className="flex items-center gap-[7px]">
        <span className="h-1 w-[26px] rounded-sm bg-cabinet-inflated" />
        <span className={label}>{t.canvas.legendChanged}</span>
      </div>
    </div>
  );
}

export function CanvasFooter({
  legend,
  zoom,
  onFit,
  onZoomIn,
  onZoomOut,
}: {
  legend?: boolean;
  zoom: number;
  onFit?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}): ReactNode {
  const t = useCabinetText();
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-[26px] left-6 right-6 z-10 flex items-center",
        legend ? "justify-between" : "justify-end",
      )}
    >
      {legend && <Legend />}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onFit}
          className={cn("flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-extrabold", FLOATING)}
        >
          <FitViewIcon className="h-[15px] w-[15px]" />
          {t.canvas.fit}
        </button>
        <div className={cn("flex items-center gap-3 px-3 py-2", FLOATING)}>
          <button type="button" onClick={onZoomOut} aria-label={t.canvas.zoomOut}>
            <MinusIcon className="h-[15px] w-[15px]" />
          </button>
          <span className="whitespace-nowrap text-[13px] font-extrabold">
            {t.canvas.zoom(Math.round(zoom * 100))}
          </span>
          <button type="button" onClick={onZoomIn} aria-label={t.canvas.zoomIn}>
            <PlusIcon className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
