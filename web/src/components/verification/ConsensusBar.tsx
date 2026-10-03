import React from "react";
import { formatTimecode, type FactCheck } from "@news/contracts";
import { History, MousePointerClick, TrendingUp, type LucideIcon } from "lucide-react";
import { plural } from "./filters";
import type { MaterialKind } from "./material";

export interface ConsensusBarProps {
  factChecks: FactCheck[];
  totalSources: number;
  material: MaterialKind;
  onSelectClaimId: (id: string) => void;
}

const MATERIAL_ACC: Record<MaterialKind, string> = { video: "видео", text: "текст", article: "статью" };

/**
 * Нижняя плашка «Что нашли»: старое событие и цифры, выросшие по пути. Каждый пункт кликабелен — выбирает
 * своё утверждение (справа откроются источники и цепочка). Позиции по утверждениям — в фильтрах «Разбора».
 */
export function ConsensusBar({ factChecks, totalSources, material, onSelectClaimId }: ConsensusBarProps) {
  // у видео — таймкод, у текста и статьи таймкодов нет: начало утверждения
  const where = (fc: FactCheck) =>
    material === "video" ? formatTimecode(fc.range.start) : `«${shorten(fc.claim || fc.quote, 28)}»`;

  const outdated = factChecks.flatMap((fc) => {
    const flag = fc.flags.find((f) => f.type === "outdated");
    return flag ? [{ fc, flag }] : [];
  })[0];
  const exaggerated = factChecks.flatMap((fc) => {
    const flag = fc.flags.find((f) => f.type === "exaggerated");
    return flag ? [{ fc, flag }] : [];
  })[0];

  return (
    <section className="flex shrink-0 flex-col rounded-[28px] bg-[#FBF8F7] p-6 pb-5 sm:px-6 sm:pt-7 lg:min-h-[255px] [@media(max-height:780px)]:lg:min-h-[220px]">
      <div className="text-[13px] font-semibold text-[#A27C7A]">
        Что нашли · {factChecks.length}{" "}
        {plural(factChecks.length, ["утверждение", "утверждения", "утверждений"])} · {totalSources}{" "}
        {plural(totalSources, ["источник", "источника", "источников"])}
      </div>
      <div className="mt-0.5 text-base font-black text-[#4A3333] sm:text-[17px]">
        Мы не оцениваем {MATERIAL_ACC[material]} — показываем, откуда что взялось
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-6">
        <Finding icon={History} iconBg="#E8DCFD" iconColor="#6E1EF0" title="Старое событие">
          {outdated ? (
            <ItemButton onClick={() => onSelectClaimId(outdated.fc.id)}>
              {where(outdated.fc)} · {outdated.flag.detail}
              {outdated.fc.keyFinding?.title && `, ${lowerFirst(outdated.fc.keyFinding.title)}`}
            </ItemButton>
          ) : (
            <Empty>старый контент не нашли</Empty>
          )}
        </Finding>

        <Finding icon={TrendingUp} iconBg="#FFE1C7" iconColor="#FF7A12" title="Цифры выросли по пути">
          {exaggerated ? (
            <ItemButton onClick={() => onSelectClaimId(exaggerated.fc.id)}>
              {where(exaggerated.fc)} · {beforeAfter(exaggerated.flag.detail)}
            </ItemButton>
          ) : (
            <Empty>раздутых цифр не нашли</Empty>
          )}
        </Finding>

      </div>

      <div className="mt-auto flex items-center gap-2 pt-6 text-xs font-semibold text-[#A27C7A]">
        <MousePointerClick className="h-4 w-4 shrink-0" />
        Каждый пункт кликабелен — ведёт к источникам и цепочке пересказов
      </div>
    </section>
  );
}

function Finding({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  children,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-extrabold text-[#4A3333]">{title}</span>
        {children}
      </div>
    </div>
  );
}

function ItemButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md border-none bg-transparent p-0 text-left text-[13px] font-semibold leading-snug text-[#A27C7A] transition-colors hover:text-[#4A3333]"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-semibold text-[#C9B8B6]">{children}</span>;
}

/** «2 → 200 пострадавших» → «было 2, стало 200 пострадавших» */
function beforeAfter(detail: string): string {
  const [before, after] = detail.split(/\s*→\s*/);
  return after ? `было ${before}, стало ${after}` : detail;
}

function shorten(text: string, max: number): string {
  const t = text.trim().replace(/[.!?]+$/, "");
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
