"use client";

/** Нарратив: группа вопросов, собранная человеком из реальных цитат. Экран 14 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCabinetActions } from "./actions";
import { CabinetShell, useOpenNarrativeDialog } from "./CabinetShell";
import { ConfirmDialog } from "./Dialogs";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, ScalesIcon } from "./icons";
import { QuestionMenu } from "./QuestionMenu";
import type { NarrativeQuestion } from "./types";
import { DEFAULT_WATCH_FORM } from "./WatchSettings";
import { Avatar, Pill, SidesBar, SidesLegend, StatusPill } from "./ui";

function Stat({
  value,
  label,
  valueClassName = "text-[20px]",
}: {
  value: string | number;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className={`whitespace-nowrap font-black ${valueClassName}`}>{value}</span>
      <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">{label}</span>
    </div>
  );
}

/**
 * Сначала уезжает шапка страницы, потом колонки прилипают и листается та, над которой курсор.
 * Браузер сам отдал бы прокрутку колонке, поэтому страницу двигаем здесь.
 */
function useStickyColumns() {
  const page = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = page.current;
    if (!main) return;
    const onWheel = (event: WheelEvent) => {
      const column = (event.target as Element).closest("[data-scroll-column]");
      const pageLeft = main.scrollHeight - main.clientHeight - main.scrollTop > 1;
      const down = event.deltaY > 0 && pageLeft;
      const up = event.deltaY < 0 && main.scrollTop > 0 && (!column || column.scrollTop <= 0);
      if (!down && !up) return;
      event.preventDefault();
      main.scrollTop += event.deltaY;
    };
    main.addEventListener("wheel", onWheel, { passive: false });
    return () => main.removeEventListener("wheel", onWheel);
  }, []);
  return page;
}

/** Поиск по слежению идёт: на месте будущей цитаты */
function QuoteSkeleton() {
  const t = useCabinetText();
  return (
    <div className="flex w-full shrink-0 animate-pulse flex-col gap-2 border-b-2 border-border pb-2.5 pt-0.5">
      <div className="flex items-center gap-[7px]">
        <span className="h-[22px] w-[22px] rounded-full bg-border" />
        <span className="text-[13px] font-black text-cabinet-ink-mid">{t.narrative.searchingQuotes}</span>
      </div>
      <span className="h-3 w-full rounded-full bg-border" />
      <span className="h-3 w-2/3 rounded-full bg-border" />
    </div>
  );
}

/** Внутри каркаса: диалог живёт в нём */
function AddQuestion({ narrativeId }: { narrativeId: string }) {
  const t = useCabinetText();
  const openNarrative = useOpenNarrativeDialog();
  return (
    <button
      type="button"
      onClick={() => openNarrative({ claimIds: [], narrativeId })}
      className="flex items-center gap-1"
    >
      <PlusIcon className="h-[15px] w-[15px]" />
      <span className="whitespace-nowrap text-[13px] font-extrabold">{t.narrative.addQuestion}</span>
    </button>
  );
}

export function NarrativeScreen({
  fixture,
}: {
  fixture: Pick<CabinetFixture, "session" | "narrative" | "overlay">;
}) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const text = t.narrative;
  const narrative = fixture.narrative;
  const count = narrative.questions.length;
  const [removing, setRemoving] = useState<NarrativeQuestion>();
  const [deleting, setDeleting] = useState<NarrativeQuestion>();
  const page = useStickyColumns();
  return (
    <CabinetShell session={fixture.session} pinnedMenu narrativeId={narrative.id} overlay={fixture.overlay}>
      <main
        ref={page}
        className="flex h-full min-w-0 flex-1 flex-col items-start gap-[18px] overflow-y-auto overscroll-none px-8 py-7"
      >
        <Link
          href="/cabinet/questions"
          className="flex items-center gap-1.5 whitespace-nowrap text-[14px] font-extrabold"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {text.back}
        </Link>
        <div className="flex w-full flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <Pill className="bg-cabinet-old-soft text-cabinet-old">{text.badge}</Pill>
            <StatusPill status={narrative.status} />
            <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">
              {text.confirmed(narrative.confirmedBy, narrative.confirmedAt)}
            </span>
          </div>
          <h1 className="w-full text-[34px] font-black [line-height:normal]">{narrative.title}</h1>
          <p className="w-full text-[15px] font-bold leading-5 text-cabinet-ink-mid">
            {narrative.description}
          </p>
          <div className="flex items-start gap-[22px] pt-1">
            <Stat value={count} label={t.plural(count, text.questionsWord)} />
            <Stat
              value={narrative.publications}
              label={t.plural(narrative.publications, text.publicationsWord)}
            />
            <Stat value={narrative.languages} label={t.plural(narrative.languages, text.languagesWord)} />
            <Stat value={narrative.lastChange} label={text.lastChange} />
          </div>
        </div>
        <div className="flex h-full w-full shrink-0 items-stretch gap-5">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start gap-2.5">
            <div className="flex w-full shrink-0 items-center justify-between">
              <h2 className="whitespace-nowrap text-[17px] font-black">{text.questions}</h2>
              <AddQuestion narrativeId={narrative.id} />
            </div>
            <div
              data-scroll-column
              className="flex min-h-0 w-full flex-col overflow-y-auto overscroll-none rounded-3xl bg-card px-5 py-1 outline outline-2 -outline-offset-1 outline-border"
            >
              {narrative.questions.map((question, index) => (
                <div
                  key={question.id}
                  className={`-mb-px flex min-h-[109px] w-full shrink-0 flex-col gap-3 py-[18px] ${index < count - 1 ? "border-b-2 border-border" : ""}`}
                >
                  <div className="flex w-full items-start gap-3">
                    <div className="flex-1 text-[16px] font-black leading-5">{question.text}</div>
                    <StatusPill status={question.status} className="px-2.5 py-[3px] text-[12px]" />
                    <QuestionMenu
                      searching={question.searching}
                      onRepeat={() => void actions.repeatSearch(question.id)}
                      onRemove={() => setRemoving(question)}
                      onDelete={() => setDeleting(question)}
                      watching={Boolean(question.watchId)}
                      onToggleWatch={() =>
                        void (question.watchId
                          ? actions.deleteWatch(question.watchId)
                          : actions.createWatch(question.id, DEFAULT_WATCH_FORM))
                      }
                    />
                  </div>
                  <SidesBar sides={question.sides} />
                  <div className="flex w-full items-center justify-between">
                    <SidesLegend sides={question.sides} />
                    <Link
                      href={actions.checkHref(question.checkId, question.id)}
                      className="flex items-center gap-1 whitespace-nowrap text-[13px] font-extrabold"
                    >
                      {text.tree}
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start gap-2.5">
            <h2 className="shrink-0 whitespace-nowrap text-[17px] font-black">{text.quotes}</h2>
            <div
              data-scroll-column
              className="flex min-h-0 w-full flex-1 flex-col items-start gap-2.5 overflow-y-auto overscroll-none"
            >
              {narrative.questions.some((question) => question.searching) && <QuoteSkeleton />}
              {narrative.quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="animate-search-rise -mb-px flex min-h-[58px] w-full shrink-0 flex-col gap-[5px] border-b-2 border-border pb-2.5 pt-0.5"
                >
                  <div className="flex items-center gap-[7px]">
                    <Avatar name={quote.outlet} color={quote.color} size={22} textClassName="text-[11px]" />
                    <span className="whitespace-nowrap text-[13px] font-black">{quote.outlet}</span>
                    <span className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
                      {quote.date}
                    </span>
                    {quote.fresh && (
                      <Pill className="bg-cabinet-new-soft text-cabinet-new">{text.freshQuote}</Pill>
                    )}
                  </div>
                  {quote.href ? (
                    <a
                      href={quote.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-[14px] font-bold leading-[18px] underline decoration-border underline-offset-2 hover:decoration-primary"
                    >
                      {quote.text}
                    </a>
                  ) : (
                    <div className="w-full text-[14px] font-bold leading-[18px]">{quote.text}</div>
                  )}
                </div>
              ))}
              <div className="flex w-full shrink-0 items-center gap-[9px] rounded-2xl bg-canvas p-3">
                <ScalesIcon className="h-[18px] w-[18px] shrink-0 text-cabinet-ink-mid" />
                <div className="flex-1 text-[12px] font-bold leading-4 text-cabinet-ink-mid">{text.note}</div>
              </div>
            </div>
          </div>
        </div>
        {deleting && (
          <ConfirmDialog
            title={t.questionMenu.deleteTitle}
            text={t.questionMenu.deleteText(deleting.text)}
            confirm={t.questionMenu.delete}
            cancel={t.questionMenu.cancel}
            onClose={() => setDeleting(undefined)}
            onConfirm={() => {
              setDeleting(undefined);
              void actions.deleteClaim(deleting.id);
            }}
          />
        )}
        {removing && (
          <ConfirmDialog
            title={t.questionMenu.removeTitle}
            text={t.questionMenu.removeText(removing.text)}
            confirm={t.questionMenu.remove}
            cancel={t.questionMenu.cancel}
            onClose={() => setRemoving(undefined)}
            onConfirm={() => {
              setRemoving(undefined);
              void actions.removeFromNarrative(narrative.id, removing.id);
            }}
          />
        )}
      </main>
    </CabinetShell>
  );
}
