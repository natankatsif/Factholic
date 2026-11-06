"use client";

/** Все вопросы: таблица, поиск по тексту, выбор строк. Экраны 13 и 16 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCabinetActions } from "./actions";
import { CabinetShell, useOpenNarrativeDialog } from "./CabinetShell";
import { ConfirmDialog } from "./Dialogs";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import { CaretDownIcon, EyeIcon, SearchIcon, SpinnerIcon, StackIcon } from "./icons";
import { POPOVER_PANEL, PopoverItem, usePopover } from "./Popover";
import { QuestionMenu } from "./QuestionMenu";
import type { CabinetLimits, ClaimScope, ClaimStatus, QuestionRow } from "./types";
import { CheckBox, Pill, StatusPill } from "./ui";

const PERIOD_DAYS = { today: 0, week: 7, month: 31 };
type Period = keyof typeof PERIOD_DAYS;

interface Filters {
  period?: Period;
  author?: string;
  language?: string;
  state?: ClaimStatus;
  group?: "ungrouped";
}

function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value?: T) => void;
}) {
  const t = useCabinetText();
  const { open, setOpen, ref } = usePopover();
  const pick = (next?: T) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-[5px] rounded-full bg-card px-3 outline outline-2 -outline-offset-1 outline-border"
      >
        <span className="whitespace-nowrap text-[14px] font-extrabold">
          {options.find((option) => option.value === value)?.label ?? label}
        </span>
        <CaretDownIcon className="h-3.5 w-3.5 text-cabinet-ink-mid" />
      </button>
      {open && (
        <div className={`${POPOVER_PANEL} right-0 top-12 min-w-[150px]`}>
          <PopoverItem active={value === undefined} onClick={() => pick(undefined)}>
            {t.filters.all}
          </PopoverItem>
          {options.map((option) => (
            <PopoverItem
              key={option.value}
              active={value === option.value}
              onClick={() => pick(option.value)}
            >
              {option.label}
            </PopoverItem>
          ))}
        </div>
      )}
    </div>
  );
}

/** Внутри каркаса: диалог нарратива живёт в нём */
function SelectionBar({
  selected,
  rows,
  limits,
  onClear,
}: {
  selected: string[];
  rows: QuestionRow[];
  limits?: CabinetLimits;
  onClear: () => void;
}) {
  const t = useCabinetText();
  const text = t.questions;
  const actions = useCabinetActions();
  const openNarrative = useOpenNarrativeDialog();
  // уже отслеживаемые места не занимают
  const toWatch = selected.filter((id) => !rows.find((row) => row.id === id)?.scopes.includes("watched"));
  const left = limits ? Math.max(limits.watchesTotal - limits.watchesUsed, 0) : 0;
  const overLimit = toWatch.length > left;
  const hint =
    toWatch.length === 0
      ? text.alreadyWatched
      : overLimit
        ? text.watchLimit(toWatch.length, left, limits?.watchesTotal ?? 0)
        : undefined;
  const watch = () => {
    void actions.watchClaims(toWatch);
    onClear();
  };
  return (
    <div className="absolute bottom-[33px] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
      {hint && (
        <div
          role="status"
          className="max-w-[640px] rounded-2xl bg-card px-4 py-2 text-center text-[13px] font-bold shadow-[0_10px_30px_#4A333333]"
        >
          {hint}
        </div>
      )}
      <div className="flex w-[720px] items-center justify-between gap-2.5 rounded-full bg-primary py-2 pl-[22px] pr-2 shadow-[0_10px_30px_#4A333355]">
        <span className="whitespace-nowrap text-[14px] font-extrabold text-white">
          {text.selected(selected.length, t.plural(selected.length, text.selectedWord))}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={Boolean(hint)}
            onClick={watch}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-[9px] text-[14px] font-extrabold disabled:opacity-50"
          >
            <EyeIcon className="h-[15px] w-[15px]" />
            {text.watch}
          </button>
          <button
            type="button"
            onClick={() => openNarrative({ claimIds: selected })}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-[9px] text-[14px] font-extrabold"
          >
            <StackIcon className="h-[15px] w-[15px]" />
            {text.collect}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="whitespace-nowrap rounded-full px-4 py-[9px] text-[14px] font-extrabold text-white"
          >
            {text.clear}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROW = "-mb-px flex w-full items-center gap-3 border-b-2 border-border";

export function QuestionsScreen({
  fixture,
  scope,
}: {
  fixture?: Pick<CabinetFixture, "session" | "questions" | "overlay">;
  scope: ClaimScope;
}) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const [filters, setFilters] = useState<Filters>({});
  const text = t.questions;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(fixture?.overlay?.selectedQuestionIds ?? []);
  const [deleting, setDeleting] = useState<QuestionRow>();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (fixture?.questions ?? []).filter(
      (row) =>
        row.scopes.includes(scope) &&
        (!needle || row.text.toLowerCase().includes(needle)) &&
        (!filters.period || row.ageDays <= PERIOD_DAYS[filters.period]) &&
        (!filters.author || row.author === filters.author) &&
        (!filters.language || row.language === filters.language) &&
        (!filters.state || row.status === filters.state) &&
        (!filters.group || row.scopes.includes(filters.group)),
    );
  }, [fixture, query, scope, filters]);

  const all = fixture?.questions ?? [];
  const unique = (values: string[]) => [...new Set(values)].map((value) => ({ value, label: value }));
  const states = [...new Set(all.map((row) => row.status))].map((value) => ({
    value,
    label: t.status[value],
  }));
  const periods = (Object.keys(PERIOD_DAYS) as Period[]).map((value) => ({
    value,
    label: t.filters.period[value],
  }));

  const total = fixture?.session.counts[scope] ?? 0;
  const toggle = (id: string, on: boolean) =>
    setSelected((list) => (on ? [...list, id] : list.filter((item) => item !== id)));

  return (
    <CabinetShell
      session={fixture?.session}

      pinnedMenu
      scope={scope}
      overlay={fixture?.overlay}
    >
      <main className="relative flex h-full min-w-0 flex-1 flex-col items-start gap-4 px-8 py-7">
        <div className="flex flex-col items-start gap-0.5">
          <h1 className="whitespace-nowrap text-[34px] font-black [line-height:normal]">{t.menu[scope]}</h1>
          <p className="whitespace-nowrap text-[15px] font-bold text-cabinet-ink-mid">
            {scope === "running"
              ? text.runningSubtitle(total)
              : text.subtitle(total, t.plural(total, text.saved))}
          </p>
        </div>
        <div className="flex w-full items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3.5 outline outline-2 -outline-offset-1 outline-border">
            <SearchIcon className="h-4 w-4 shrink-0 text-cabinet-ink-mid" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.search}
              aria-label={text.search}
              className="min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none placeholder:text-cabinet-ink-mid"
            />
          </label>
          <FilterPill
            label={text.filters.period}
            value={filters.period}
            options={periods}
            onChange={(period) => setFilters((list) => ({ ...list, period }))}
          />
          <FilterPill
            label={text.filters.author}
            value={filters.author}
            options={unique(all.map((row) => row.author))}
            onChange={(author) => setFilters((list) => ({ ...list, author }))}
          />
          <FilterPill
            label={text.filters.language}
            value={filters.language}
            options={unique(all.map((row) => row.language).filter(Boolean))}
            onChange={(language) => setFilters((list) => ({ ...list, language }))}
          />
          <FilterPill
            label={text.filters.group}
            value={filters.group}
            options={[{ value: "ungrouped" as const, label: t.menu.ungrouped }]}
            onChange={(group) => setFilters((list) => ({ ...list, group }))}
          />
          <FilterPill
            label={text.filters.state}
            value={filters.state}
            options={states}
            onChange={(state) => setFilters((list) => ({ ...list, state }))}
          />
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-none rounded-3xl bg-card px-5 py-1 outline outline-2 -outline-offset-1 outline-border">
          <div className={`${ROW} h-[45px] shrink-0 text-[13px] font-extrabold text-cabinet-ink-mid`}>
            <div className="w-[22px] shrink-0" />
            <div className="min-w-0 flex-1">{text.columns.claim}</div>
            <div className="w-[158px] shrink-0">{text.columns.narrative}</div>
            <div className="w-[70px] shrink-0">{text.columns.checks}</div>
            <div className="w-[130px] shrink-0">{text.columns.last}</div>
            <div className="w-[154px] shrink-0">{text.columns.state}</div>
            <div className="w-8 shrink-0" />
          </div>
          {rows.map((row) => (
            <div key={row.id} className={`${ROW} min-h-[84px] shrink-0 py-3`}>
              <div className="flex w-[22px] shrink-0">
                {row.runningStep ? (
                  <SpinnerIcon className="h-5 w-5 animate-spin text-cabinet-blue" />
                ) : (
                  <CheckBox
                    checked={selected.includes(row.id)}
                    onChange={(on) => toggle(row.id, on)}
                    label={text.select(row.text)}
                  />
                )}
              </div>
              <Link
                href={actions.checkHref(row.checkId, row.id)}
                className="flex min-w-0 flex-1 flex-col gap-[3px]"
              >
                <span className="w-full text-[15px] font-black leading-[19px]">{row.text}</span>
                <span className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
                  {text.author(row.author, row.date, row.language)}
                </span>
              </Link>
              <div className="flex w-[158px] shrink-0">
                {row.narrative ? (
                  <div className="flex-1 rounded-xl bg-cabinet-old-soft px-2.5 py-1 text-[12px] font-extrabold leading-[14px] text-cabinet-old">
                    {row.narrative}
                  </div>
                ) : (
                  <span className="text-[14px] font-bold text-cabinet-ink-mid">{text.none}</span>
                )}
              </div>
              <div className="w-[70px] shrink-0 text-[15px] font-black">{row.checks}</div>
              <div className="w-[130px] shrink-0 whitespace-nowrap text-[13px] font-bold">{row.last}</div>
              <div className="flex w-[154px] shrink-0 flex-col items-start gap-1.5">
                {row.runningStep ? (
                  <Pill className="bg-cabinet-blue/10 text-cabinet-blue">{t.panel.checkRunning}</Pill>
                ) : (
                  <StatusPill status={row.status} />
                )}
                {scope !== "watched" && row.scopes.includes("watched") && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-[12px] font-extrabold text-cabinet-blue">
                    <EyeIcon className="h-3.5 w-3.5" />
                    {text.watchedBadge}
                  </span>
                )}
              </div>
              <div className="flex w-8 shrink-0 justify-end">
                {!row.runningStep && (
                  <QuestionMenu
                    searching={row.searching}
                    onRepeat={() => void actions.repeatSearch(row.id)}
                    onDelete={() => setDeleting(row)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <SelectionBar
            selected={selected}
            rows={all}
            limits={fixture?.session.limits}
            onClear={() => setSelected([])}
          />
        )}
        {deleting && (
          <ConfirmDialog
            title={t.questionMenu.deleteTitle}
            text={t.questionMenu.deleteText(deleting.text)}
            confirm={t.questionMenu.delete}
            cancel={t.questionMenu.cancel}
            onClose={() => setDeleting(undefined)}
            onConfirm={() => {
              setDeleting(undefined);
              setSelected((list) => list.filter((id) => id !== deleting.id));
              void actions.deleteClaim(deleting.id);
            }}
          />
        )}
      </main>
    </CabinetShell>
  );
}
