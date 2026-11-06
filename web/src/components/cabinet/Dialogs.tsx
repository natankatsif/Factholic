"use client";

/** Диалоги кабинета: цитаты предложения и сборка нарратива. Экранов для них в дизайне нет, стиль как у карточек */
import { useState } from "react";
import type { ReactNode } from "react";
import { useCabinetActions } from "./actions";
import { useCabinetText } from "./dictionary";
import { CloseIcon } from "./icons";
import type { SuggestionView } from "./types";
import { Avatar, CheckBox } from "./ui";

const BUTTON = "rounded-full px-4 py-[9px] text-[14px] font-extrabold whitespace-nowrap";
const DARK = `${BUTTON} bg-primary text-white disabled:bg-border disabled:text-cabinet-ink-mid`;
const OUTLINE = `${BUTTON} outline outline-2 -outline-offset-1 outline-primary`;
const FIELD =
  "w-full rounded-[14px] bg-canvas px-3 py-2.5 text-[14px] font-bold outline-none placeholder:text-cabinet-ink-mid";

function Dialog({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = useCabinetText();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/25 p-6">
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-full w-[540px] flex-col gap-3 overflow-hidden rounded-3xl bg-card p-[18px] shadow-[0_10px_30px_#4A333333]"
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-[19px] font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.suggestion.close}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-canvas"
          >
            <CloseIcon className="h-[15px] w-[15px]" />
          </button>
        </div>
        {/* прокручивается только содержимое: заголовок и кнопки всегда на месте */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-none">{children}</div>
        <div className="flex shrink-0 gap-2">{footer}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  text,
  confirm,
  cancel,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  confirm: string;
  cancel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onConfirm} className={DARK}>
            {confirm}
          </button>
          <button type="button" onClick={onClose} className={OUTLINE}>
            {cancel}
          </button>
        </>
      }
    >
      <p className="text-[14px] font-bold leading-[19px]">{text}</p>
    </Dialog>
  );
}

export function SuggestionDialog({
  suggestion,
  onClose,
  onCollect,
}: {
  suggestion: SuggestionView;
  onClose: () => void;
  onCollect: () => void;
}) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const text = t.suggestion;
  return (
    <Dialog
      title={text.dialogTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onCollect} className={DARK}>
            {text.collect}
          </button>
          <button
            type="button"
            onClick={() => {
              void actions.dismissSuggestion(suggestion.id);
              onClose();
            }}
            className={OUTLINE}
          >
            {text.dismiss}
          </button>
        </>
      }
    >
      <p className="text-[14px] font-bold leading-[19px] text-cabinet-ink-mid">{text.dialogHint}</p>
      <div className="text-[15px] font-black">{text.questionsTitle}</div>
      {suggestion.claims.map((claim) => (
        <div key={claim.id} className="text-[14px] font-extrabold leading-[18px]">
          «{claim.text}»
        </div>
      ))}
      <div className="text-[15px] font-black">{text.quotesTitle}</div>
      {suggestion.quotes.map((quote) => (
        <div
          key={`${quote.outlet}${quote.text}`}
          className="flex flex-col gap-1 border-b-2 border-border pb-2.5"
        >
          <div className="flex items-center gap-[7px]">
            <Avatar name={quote.outlet} color="#7A5C5A" size={22} textClassName="text-[11px]" />
            {quote.url ? (
              <a href={quote.url} target="_blank" rel="noreferrer" className="text-[13px] font-black">
                {quote.outlet}
              </a>
            ) : (
              <span className="text-[13px] font-black">{quote.outlet}</span>
            )}
            <span className="text-[12px] font-bold text-cabinet-ink-mid">{quote.date}</span>
          </div>
          <div className="text-[14px] font-bold leading-[18px]">{quote.text}</div>
        </div>
      ))}
    </Dialog>
  );
}

export function NarrativeDialog({
  initialClaimIds,
  suggestionId,
  narrativeId,
  onClose,
}: {
  initialClaimIds: string[];
  suggestionId?: string;
  /** Есть — добавляем вопросы в готовый нарратив, полей названия нет */
  narrativeId?: string;
  onClose: () => void;
}) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const form = t.narrativeForm;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [claimIds, setClaimIds] = useState(initialClaimIds);
  const ready = claimIds.length > 0 && (Boolean(narrativeId) || title.trim().length > 0);

  const save = async () => {
    if (narrativeId) await actions.addToNarrative(narrativeId, claimIds);
    else await actions.createNarrative({ title, description, claimIds, suggestionId });
    onClose();
  };

  return (
    <Dialog
      title={narrativeId ? form.addTitle : form.createTitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" disabled={!ready} onClick={() => void save()} className={DARK}>
            {narrativeId ? form.add : form.save}
          </button>
          <button type="button" onClick={onClose} className={OUTLINE}>
            {form.cancel}
          </button>
        </>
      }
    >
      {!narrativeId && (
        <>
          <label className="flex flex-col gap-1.5 text-[15px] font-black">
            {form.name}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={form.namePlaceholder}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[15px] font-black">
            {form.description}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={form.descriptionPlaceholder}
              rows={3}
              className={FIELD}
            />
          </label>
        </>
      )}
      <div className="text-[15px] font-black">{form.questions}</div>
      {actions.pickerClaims.length === 0 && (
        <div className="text-[14px] font-bold text-cabinet-ink-mid">{form.noQuestions}</div>
      )}
      {actions.pickerClaims.map((claim) => (
        <div key={claim.id} className="flex items-start gap-2">
          <CheckBox
            checked={claimIds.includes(claim.id)}
            label={claim.text}
            onChange={(on) =>
              setClaimIds((list) => (on ? [...list, claim.id] : list.filter((id) => id !== claim.id)))
            }
          />
          <span className="flex-1 text-[14px] font-bold leading-[18px]">{claim.text}</span>
        </div>
      ))}
    </Dialog>
  );
}
