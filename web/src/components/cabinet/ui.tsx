/** Мелкие общие элементы кабинета */
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useCabinetText } from "./dictionary";
import { CheckIcon } from "./icons";
import type { ClaimStatus, SidesSummary } from "./types";

const STATUS_TONE: Record<ClaimStatus, string> = {
  checking: "animate-pulse bg-cabinet-blue/10 text-cabinet-blue",
  outdated: "bg-cabinet-old-soft text-cabinet-old",
  inflated: "bg-cabinet-inflated-soft text-cabinet-inflated-text",
  against: "bg-cabinet-against-soft text-cabinet-against-text",
  split: "bg-cabinet-split-soft text-primary",
  converging: "bg-cabinet-agree-soft text-cabinet-agree",
  few: "bg-canvas text-cabinet-ink-mid",
  new: "bg-cabinet-blue/10 text-cabinet-blue",
  spreading: "bg-cabinet-inflated-soft text-cabinet-inflated-text",
  stable: "bg-primary/10 text-primary",
  debunked: "bg-cabinet-old-soft text-cabinet-old",
  fading: "bg-canvas text-cabinet-ink-mid",
};

export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-extrabold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status, className }: { status: ClaimStatus; className?: string }) {
  const t = useCabinetText();
  return <Pill className={cn(STATUS_TONE[status], className)}>{t.status[status]}</Pill>;
}

export function Avatar({
  name,
  color,
  size = 28,
  textClassName = "text-[13px]",
}: {
  name: string;
  color: string;
  size?: number;
  textClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-black text-white",
        textClassName,
      )}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {name.charAt(0)}
    </span>
  );
}

/** Галочка из дизайна. Рамка нарисована outline, как на экранах */
export function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md outline outline-2 -outline-offset-1",
        checked ? "bg-primary outline-primary" : "outline-cabinet-ink-soft",
      )}
    >
      {checked && <CheckIcon className="h-[13px] w-[13px] text-white" />}
    </button>
  );
}

/** Круглая подложка иконки в ленте */
export function IconCircle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn("flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full", className)}
    >
      {children}
    </span>
  );
}

const SIDE_COLORS = {
  for: "bg-cabinet-agree",
  against: "bg-destructive",
  partial: "bg-cabinet-split",
  neutral: "bg-cabinet-ink-soft",
} as const;

const SIDES = ["for", "against", "partial", "neutral"] as const;

/** Полоска позиций: ширина считается из счёта, ноль сегмента не даёт */
export function SidesBar({ sides }: { sides: SidesSummary }) {
  return (
    <div className="flex w-full gap-[3px]">
      {SIDES.filter((side) => sides[side] > 0).map((side) => (
        <div
          key={side}
          className={cn("h-2 rounded-[4px]", SIDE_COLORS[side])}
          style={{ flexGrow: sides[side], flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

/** Подпись к полоске: ноль остаётся в счёте */
export function SidesLegend({ sides }: { sides: SidesSummary }) {
  const t = useCabinetText();
  const labels = {
    for: t.feed.sideFor,
    against: t.feed.sideAgainst,
    partial: t.feed.sidePartial,
    neutral: t.feed.sideNeutral,
  };
  return (
    <div className="flex items-center gap-3">
      {SIDES.map((side) => (
        <div key={side} className="flex items-center gap-[5px]">
          <span className={cn("h-2 w-2 rounded-full", sides[side] > 0 ? SIDE_COLORS[side] : "bg-border")} />
          <span className="text-[13px] font-black">{sides[side]}</span>
          <span className="text-[13px] font-bold text-cabinet-ink-mid">{labels[side]}</span>
        </div>
      ))}
    </div>
  );
}
