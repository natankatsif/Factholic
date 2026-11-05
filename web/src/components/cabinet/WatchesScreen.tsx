"use client";

/** Список слежений: фильтры, переключатель вкл / пауза / выкл. Экран 08 */
import { useState } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { useCabinetActions } from "./actions";
import { CabinetShell } from "./CabinetShell";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import { DotsIcon } from "./icons";
import { POPOVER_PANEL, PopoverItem, usePopover } from "./Popover";
import type { WatchRow, WatchStatus } from "./types";
import { StatusPill } from "./ui";

type WatchFilter = "all" | "spreading" | "withNew" | "paused";

const FILTERS: Record<WatchFilter, (row: WatchRow) => boolean> = {
  all: () => true,
  spreading: (row) => row.claimStatus === "spreading",
  withNew: (row) => row.fresh > 0,
  paused: (row) => row.status === "paused",
};

const NEXT_STATUS: Record<WatchStatus, WatchStatus> = {
  active: "paused",
  paused: "finished",
  finished: "active",
};

const TOGGLE: Record<WatchStatus, { track: string; knob: string }> = {
  active: { track: "bg-cabinet-agree", knob: "left-[21px]" },
  paused: { track: "bg-cabinet-split", knob: "left-[11px]" },
  finished: { track: "bg-border", knob: "left-[3px]" },
};

function RowMenu({ row, onRemove }: { row: WatchRow; onRemove: () => void }) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={t.watches.more} aria-expanded={open} onClick={() => setOpen(!open)}>
        <DotsIcon className="h-[22px] w-[22px] text-cabinet-ink-mid" />
      </button>
      {open && (
        <div className={`${POPOVER_PANEL} right-0 top-7`}>
          <PopoverItem
            onClick={() => {
              setOpen(false);
              void actions.checkWatch(row.id);
            }}
          >
            {t.rowMenu.checkNow}
          </PopoverItem>
          <Link
            href={actions.checkHref(row.checkId, row.claimId)}
            className="block whitespace-nowrap rounded-[14px] px-3 py-2 text-[14px] font-extrabold hover:bg-canvas"
          >
            {t.rowMenu.openTree}
          </Link>
          <PopoverItem
            danger
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            {t.rowMenu.remove}
          </PopoverItem>
        </div>
      )}
    </div>
  );
}

export function WatchesScreen({
  fixture,
}: {
  fixture?: Pick<CabinetFixture, "session" | "watches" | "overlay">;
}) {
  const t = useCabinetText();
  const text = t.watches;
  const actions = useCabinetActions();
  const [local, setLocal] = useState<Partial<Record<string, WatchStatus | "removed">>>({});
  const rows = (fixture?.watches ?? []).flatMap((row) => {
    const status = local[row.id] ?? row.status;
    return status === "removed" ? [] : [{ ...row, status }];
  });
  const [filter, setFilter] = useState<WatchFilter>("all");
  const limits = fixture?.session.limits;

  const cycle = (row: WatchRow) => {
    const status = NEXT_STATUS[row.status];
    setLocal((all) => ({ ...all, [row.id]: status }));
    void actions.setWatchStatus(row.id, status);
  };
  const remove = (id: string) => {
    setLocal((all) => ({ ...all, [id]: "removed" }));
    void actions.deleteWatch(id);
  };

  return (
    <CabinetShell session={fixture?.session} scope="watched" pinnedMenu overlay={fixture?.overlay}>
      <main className="flex h-full min-w-0 flex-1 flex-col items-start gap-6 overflow-y-auto overscroll-none px-12 py-8">
        <div className="flex w-full items-end justify-between">
          <div className="flex flex-col items-start gap-1">
            <h1 className="whitespace-nowrap text-[36px] font-black [line-height:normal]">{text.title}</h1>
            {limits && (
              <p className="whitespace-nowrap text-[15px] font-bold text-cabinet-ink-mid">
                {text.subtitle(
                  limits.watchesUsed,
                  limits.watchesTotal,
                  limits.month,
                  limits.checksUsed,
                  limits.checksTotal,
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {(Object.keys(FILTERS) as WatchFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3.5 py-[7px] text-[14px] font-extrabold outline outline-2 -outline-offset-1",
                  key === filter ? "bg-primary text-white outline-primary" : "bg-card outline-border",
                )}
              >
                {text.filterLabel(text.filters[key], rows.filter(FILTERS[key]).length)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-col rounded-[28px] bg-card px-6 py-2 outline outline-2 -outline-offset-1 outline-border">
          <div className="-mb-px flex h-[49px] w-full items-center gap-4 border-b-2 border-border text-[13px] font-extrabold text-cabinet-ink-mid">
            <div className="min-w-0 flex-1">{text.columns.claim}</div>
            <div className="w-[180px] shrink-0">{text.columns.state}</div>
            <div className="w-[90px] shrink-0">{text.columns.fresh}</div>
            <div className="w-[190px] shrink-0">{text.columns.last}</div>
            <div className="w-[170px] shrink-0">{text.columns.watch}</div>
            <div className="w-8 shrink-0" />
          </div>
          {rows.filter(FILTERS[filter]).map((row, index, shown) => (
            <div
              key={row.id}
              className={cn(
                "-mb-px flex min-h-[101px] w-full items-center gap-4 py-4",
                index < shown.length - 1 && "border-b-2 border-border",
              )}
            >
              <Link
                href={actions.checkHref(row.checkId, row.claimId)}
                className="min-w-0 flex-1 text-[16px] font-black"
              >
                {row.text}
              </Link>
              <div className="flex w-[180px] shrink-0">
                <StatusPill status={row.claimStatus} className="px-3 py-[5px] text-[14px]" />
              </div>
              <div className="flex w-[90px] shrink-0">
                {row.fresh > 0 ? (
                  <span className="rounded-full bg-cabinet-new px-2.5 py-[3px] text-[14px] font-black text-white">
                    {text.fresh(row.fresh)}
                  </span>
                ) : (
                  <span className="text-[14px] font-bold text-cabinet-ink-mid">{text.none}</span>
                )}
              </div>
              <div className="w-[190px] shrink-0 whitespace-nowrap text-[14px] font-bold">{row.last}</div>
              <div className="flex w-[170px] shrink-0 items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.status === "active"}
                  aria-label={text.toggle[row.status]}
                  onClick={() => cycle(row)}
                  className={cn("relative h-[26px] w-11 shrink-0 rounded-[13px]", TOGGLE[row.status].track)}
                >
                  <span
                    className={cn(
                      "absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left]",
                      TOGGLE[row.status].knob,
                    )}
                  />
                </button>
                <span className="whitespace-nowrap text-[14px] font-extrabold">
                  {text.toggle[row.status]}
                </span>
              </div>
              <div className="flex w-8 shrink-0 items-center">
                <RowMenu row={row} onRemove={() => remove(row.id)} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </CabinetShell>
  );
}
