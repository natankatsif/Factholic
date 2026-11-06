"use client";

/** Блок «Ход поиска»: мини-превью внизу холста, по клику снизу вверх открывается, что поиск делает сейчас */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCabinetText } from "./dictionary";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretUpIcon,
  CheckCircleIcon,
  DashedCircleIcon,
  SearchIcon,
  SpinnerIcon,
  XCircleIcon,
} from "./icons";
import { colorOf } from "./live-map";
import type { SearchActivity, SearchStep } from "./types";
import { Avatar } from "./ui";
import { cn } from "../../lib/utils";

function StepIcon({ status }: { status: SearchStep["status"] }) {
  const size = "h-[17px] w-[17px] shrink-0";
  if (status === "done") return <CheckCircleIcon className={cn(size, "text-cabinet-agree")} />;
  if (status === "running") return <SpinnerIcon className={cn(size, "animate-spin text-cabinet-blue")} />;
  if (status === "failed") return <XCircleIcon className={cn(size, "text-destructive")} />;
  return <DashedCircleIcon className={cn(size, "text-cabinet-ink-soft")} />;
}

type Activity = Exclude<SearchActivity, { kind: "start" }>;

/** Каждый запуск поиска отдельно: первый, потом «Найти ещё» и повторные */
export function splitRuns(activity: SearchActivity[]): Activity[][] {
  const runs: Activity[][] = [[]];
  for (const item of activity) {
    if (item.kind !== "start") runs.at(-1)!.push(item);
    else if (runs.at(-1)!.length > 0) runs.push([]);
  }
  return runs;
}

function totals(activity: Activity[]) {
  const result = { queries: 0, pages: 0, removed: 0, links: 0 };
  for (const item of activity) {
    if (item.kind === "queries") result.queries += item.texts.length;
    if (item.kind === "filtered") {
      result.pages += item.checked;
      result.removed += item.checked - item.kept;
    }
    if (item.kind === "tree") result.links = item.links;
  }
  return result;
}

/** Сайты, которые уже прошли отбор: последние сверху */
function sitesOf(activity: Activity[]): string[] {
  const all = activity.flatMap((item) => (item.kind === "filtered" ? item.sites : []));
  return [...new Set(all)].reverse();
}

/** Слова, которые поиск пробует: запросы и редкие названия, самые свежие */
function wordsOf(activity: Activity[]): string[] {
  const all = activity.flatMap((item) =>
    item.kind === "queries" ? item.texts : item.kind === "anchors" ? item.terms : [],
  );
  return all.slice(-MAX_TICKER_WORDS);
}

const MAX_TICKER_WORDS = 12;
const TICKER_MS = 1800;
const COUNT_MS = 500;

/** Число бежит к новому значению */
function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const part = Math.min((now - start) / COUNT_MS, 1);
      const next = Math.round(begin + (value - begin) * part);
      from.current = next;
      setShown(next);
      if (part < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/** Строка, где сменяются слова поиска */
function Ticker({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (words.length < 2) return;
    const timer = setInterval(() => setIndex((value) => value + 1), TICKER_MS);
    return () => clearInterval(timer);
  }, [words.length]);
  if (words.length === 0) return null;
  const word = words[index % words.length]!;
  return (
    <div className="h-[26px] w-full overflow-hidden">
      <span
        key={`${index}-${word}`}
        className="animate-search-rise block max-w-full truncate rounded-lg bg-canvas px-2 py-1 text-[12px] font-bold"
      >
        {word}
      </span>
    </div>
  );
}

function StepBar({ steps }: { steps: SearchStep[] }) {
  return (
    <div className="flex w-full gap-1" aria-hidden="true">
      {steps.map((step) => (
        <span
          key={step.key}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors duration-500",
            step.status === "done" && "bg-cabinet-agree",
            step.status === "running" && "animate-pulse bg-cabinet-blue",
            step.status === "failed" && "bg-destructive",
            step.status === "waiting" && "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-[17px] font-black tabular-nums leading-5">{shown}</span>
      <span className="truncate text-[11px] font-bold text-cabinet-ink-mid">{label}</span>
    </div>
  );
}

function Sites({ sites }: { sites: string[] }) {
  if (sites.length === 0) return null;
  return (
    <div className="flex w-full items-center">
      {sites.slice(0, 7).map((site, index) => (
        <span
          key={site}
          title={site}
          className={cn("animate-search-pop rounded-full ring-2 ring-card", index > 0 && "-ml-1.5")}
        >
          <Avatar name={site} color={colorOf(site)} size={22} textClassName="text-[11px] uppercase" />
        </span>
      ))}
      {sites.length > 7 && (
        <span className="pl-1.5 text-[12px] font-extrabold text-cabinet-ink-mid">+{sites.length - 7}</span>
      )}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex w-full flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="max-w-full truncate rounded-lg bg-canvas px-2 py-0.5 text-[12px] font-bold"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const text = useCabinetText().search;
  if (item.kind === "queries") {
    return (
      <div className="flex w-full flex-col gap-1">
        <span className="text-[13px] font-black">{text.activityQueries}</span>
        <Chips items={item.texts} />
      </div>
    );
  }
  if (item.kind === "anchors") {
    return (
      <div className="flex w-full flex-col gap-1">
        <span className="text-[13px] font-black">{text.activityAnchors}</span>
        <Chips items={item.terms} />
      </div>
    );
  }
  if (item.kind === "filtered") {
    return (
      <div className="flex w-full flex-col gap-1.5">
        <span className="text-[13px] font-black">{text.activityFiltered(item.checked, item.kept)}</span>
        <Sites sites={item.sites} />
      </div>
    );
  }
  return <span className="text-[13px] font-black">{text.activityTree(item.publications, item.links)}</span>;
}

/** Сворачивается и разворачивается плавно: высота блока меняется вместе с содержимым */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden">{children}</div>
    </div>
  );
}

function RunNavigator({
  index,
  total,
  onChange,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
}) {
  const text = useCabinetText().search;
  const arrow =
    "flex h-7 w-7 items-center justify-center rounded-full bg-canvas disabled:opacity-40 disabled:cursor-default";
  return (
    <div className="flex w-full shrink-0 items-center justify-between">
      <button
        type="button"
        aria-label={text.previousRun}
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
        className={arrow}
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
      </button>
      <span key={index} className="animate-search-rise text-[13px] font-black tabular-nums">
        {text.runLabel(index + 1, total)}
      </span>
      <button
        type="button"
        aria-label={text.nextRun}
        disabled={index === total - 1}
        onClick={() => onChange(index + 1)}
        className={arrow}
      >
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SearchProgress({
  steps,
  activity,
  searching,
  open,
  onToggle,
}: {
  steps: SearchStep[];
  activity: SearchActivity[];
  /** Идёт «Найти ещё»: шаги проверки уже закрыты, но поиск работает */
  searching: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const text = useCabinetText().search;
  const runs = splitRuns(activity);
  const last = runs.length - 1;
  // новый поиск открывается сам, старые листаются стрелками
  const [picked, setPicked] = useState(last);
  useEffect(() => setPicked(last), [last]);
  const index = Math.min(picked, last);
  const run = runs[index]!;
  const count = totals(run);
  const current = steps.find((step) => step.status === "running" || step.status === "failed");
  const working = searching || steps.some((step) => step.status === "running");
  const onLatest = index === last;
  // первый кадр закрыт, чтобы открытие было видно и при появлении блока
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(open), [open]);
  // поиск закончился: остаётся маленькая строка с историей
  const compact = !working && !expanded;
  const all = totals(runs.flat());

  // холст забирает колёсико себе, поэтому внутри блока прокрутку отдаём списку
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = panel.current;
    if (!box) return;
    const keep = (event: WheelEvent) => event.stopPropagation();
    box.addEventListener("wheel", keep);
    return () => box.removeEventListener("wheel", keep);
  }, []);

  return (
    <div
      ref={panel}
      className={cn(
        "absolute bottom-[84px] left-6 z-20 flex flex-col rounded-3xl bg-card outline outline-2 -outline-offset-1 outline-border transition-[width,padding] duration-300 ease-out",
        expanded ? "w-[440px] p-3.5" : compact ? "w-[262px] px-3.5 py-2.5" : "w-[262px] p-3.5",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full shrink-0 items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="whitespace-nowrap text-[15px] font-black">
            {compact ? text.historyTitle(runs.length) : text.title}
          </span>
          {compact && (
            <span className="truncate text-[12px] font-bold text-cabinet-ink-mid">
              {all.pages} {text.counterPages} · {all.links} {text.counterLinks}
            </span>
          )}
        </span>
        <CaretUpIcon
          aria-label={expanded ? text.collapse : text.expand}
          className={cn(
            "h-4 w-4 shrink-0 text-cabinet-ink-mid transition-transform duration-300",
            !expanded && "rotate-180",
          )}
        />
      </button>
      <Fold open={!compact}>
        <div className="pt-2.5">
          <StepBar steps={steps} />
        </div>
        {current && onLatest && (
          <div className="flex w-full items-start gap-2">
            <StepIcon status={current.status} />
            <span key={current.key} className="animate-search-rise flex-1 text-[13px] font-black leading-4">
              {current.status === "failed" ? text.failedStep : text.steps[current.key]}
            </span>
          </div>
        )}
        {working && onLatest && <Ticker words={wordsOf(run)} />}
        <div className="flex w-full shrink-0 gap-2">
          <Counter value={count.queries} label={text.counterQueries} />
          <Counter value={count.pages} label={text.counterPages} />
          <Counter value={count.removed} label={text.counterRemoved} />
          <Counter value={count.links} label={text.counterLinks} />
        </div>
      </Fold>
      <Fold open={!compact && !expanded}>
        <div className="pt-2.5">
          <Sites sites={sitesOf(run)} />
        </div>
        <button
          type="button"
          onClick={onToggle}
          tabIndex={compact || expanded ? -1 : 0}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-canvas py-2 text-[13px] font-extrabold"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          {text.openProcess}
        </button>
      </Fold>
      <Fold open={expanded}>
        <div className="mt-2.5 flex max-h-[min(460px,50vh)] w-full flex-col gap-3 overflow-y-auto overscroll-contain border-t-2 border-border pr-3 pt-3 [scrollbar-gutter:stable] [scrollbar-width:thin]">
          {runs.length > 1 && <RunNavigator index={index} total={runs.length} onChange={setPicked} />}
          {working && onLatest && (
            <div className="flex w-full flex-col gap-1.5">
              {steps.map((step) => (
                <div key={step.key} className="flex w-full items-start gap-2">
                  <StepIcon status={step.status} />
                  <div
                    className={cn(
                      "flex-1 text-[13px] leading-4",
                      step.status === "waiting" ? "font-bold text-cabinet-ink-mid" : "font-black",
                    )}
                  >
                    {step.status === "failed" ? text.failedStep : text.steps[step.key]}
                  </div>
                  {step.found !== undefined && <div className="text-[13px] font-black">{step.found}</div>}
                </div>
              ))}
            </div>
          )}
          <div className="text-[14px] font-black">{text.timeline}</div>
          {run.length === 0 && (
            <div className="text-[13px] font-bold text-cabinet-ink-mid">{text.activityEmpty}</div>
          )}
          {[...run].reverse().map((item, position) => (
            <div key={`${index}-${run.length - position}`} className="animate-search-rise w-full">
              <ActivityRow item={item} />
            </div>
          ))}
        </div>
      </Fold>
    </div>
  );
}
