"use client";

/** Нарратив: группа вопросов, собранная человеком из реальных цитат. Экран 14 */
import { useState } from "react";
import Link from "next/link";
import { useCabinetActions } from "./actions";
import { CabinetShell, useOpenNarrativeDialog } from "./CabinetShell";
import { ConfirmDialog } from "./Dialogs";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, ScalesIcon } from "./icons";
import { QuestionMenu } from "./QuestionMenu";
import type { NarrativeQuestion } from "./types";
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
  return (
    <CabinetShell session={fixture.session} pinnedMenu narrativeId={narrative.id} overlay={fixture.overlay}>
      <main className="flex h-full min-w-0 flex-1 flex-col items-start gap-[18px] overflow-y-auto overscroll-none px-8 py-7">
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
        <div className="flex w-full flex-1 items-start gap-5">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
            <div className="flex w-full items-center justify-between">
              <h2 className="whitespace-nowrap text-[17px] font-black">{text.questions}</h2>
              <AddQuestion narrativeId={narrative.id} />
            </div>
            <div className="flex w-full flex-col rounded-3xl bg-card px-5 py-1 outline outline-2 -outline-offset-1 outline-border">
              {narrative.questions.map((question, index) => (
                <div
                  key={question.id}
                  className={`-mb-px flex min-h-[109px] w-full flex-col gap-3 py-[18px] ${index < count - 1 ? "border-b-2 border-border" : ""}`}
                >
                  <div className="flex w-full items-start gap-3">
                    <div className="flex-1 text-[16px] font-black leading-5">{question.text}</div>
                    {question.searching ? (
                      <Pill className="bg-cabinet-blue/10 text-cabinet-blue">{t.questionMenu.searching}</Pill>
                    ) : (
                      <StatusPill status={question.status} className="px-2.5 py-[3px] text-[12px]" />
                    )}
                    <QuestionMenu
                      searching={question.searching}
                      onRepeat={() => void actions.repeatSearch(question.id)}
                      onRemove={() => setRemoving(question)}
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
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
            <h2 className="whitespace-nowrap text-[17px] font-black">{text.quotes}</h2>
            {narrative.quotes.map((quote) => (
              <div
                key={quote.id}
                className="-mb-px flex min-h-[58px] w-full flex-col gap-[5px] border-b-2 border-border pb-2.5 pt-0.5"
              >
                <div className="flex items-center gap-[7px]">
                  <Avatar name={quote.outlet} color={quote.color} size={22} textClassName="text-[11px]" />
                  <span className="whitespace-nowrap text-[13px] font-black">{quote.outlet}</span>
                  <span className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
                    {quote.date}
                  </span>
                </div>
                <div className="w-full text-[14px] font-bold leading-[18px]">{quote.text}</div>
              </div>
            ))}
            <div className="flex w-full items-center gap-[9px] rounded-2xl bg-canvas p-3">
              <ScalesIcon className="h-[18px] w-[18px] shrink-0 text-cabinet-ink-mid" />
              <div className="flex-1 text-[12px] font-bold leading-4 text-cabinet-ink-mid">{text.note}</div>
            </div>
          </div>
        </div>
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
