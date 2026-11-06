"use client";

/** Три точки у вопроса: повторить поиск, в нарративе ещё и убрать из него */
import { useCabinetText } from "./dictionary";
import { DotsIcon } from "./icons";
import { POPOVER_PANEL, PopoverItem, usePopover } from "./Popover";

export function QuestionMenu({
  searching,
  onRepeat,
  onRemove,
}: {
  searching?: boolean;
  onRepeat: () => void;
  onRemove?: () => void;
}) {
  const t = useCabinetText();
  const text = t.questionMenu;
  const { open, setOpen, ref } = usePopover();
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={text.label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-canvas"
      >
        <DotsIcon className="h-[22px] w-[22px] text-cabinet-ink-mid" />
      </button>
      {open && (
        <div className={`${POPOVER_PANEL} right-0 top-9 min-w-[200px]`}>
          {!searching && <PopoverItem onClick={() => choose(onRepeat)}>{text.repeatSearch}</PopoverItem>}
          {onRemove && (
            <PopoverItem danger onClick={() => choose(onRemove)}>
              {text.removeFromNarrative}
            </PopoverItem>
          )}
          {searching && !onRemove && <div className="px-3 py-2 text-[14px] font-bold">{text.searching}</div>}
        </div>
      )}
    </div>
  );
}
