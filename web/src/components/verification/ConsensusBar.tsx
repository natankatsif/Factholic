import React from "react";
import { Flag, Frown, Meh, MousePointerClick, Smile, type LucideIcon } from "lucide-react";
import { CornerEmojis } from "./CornerEmojis";
import { plural, type ClaimFilter, type FilterCounts } from "./filters";

export interface ConsensusBarProps {
  counts: FilterCounts;
  activeFilter: ClaimFilter;
  onSelectFilter: (filter: ClaimFilter) => void;
}

const ITEMS: Array<{
  id: ClaimFilter;
  title: string;
  subtitle: string;
  color: string;
  icon: LucideIcon;
  iconColor: string;
}> = [
  {
    id: "converge",
    title: "Сходятся",
    subtitle: "позиции совпадают",
    color: "#1DA57A",
    icon: Smile,
    iconColor: "#fff",
  },
  {
    id: "split",
    title: "Разделились",
    subtitle: "мнения расходятся",
    color: "#FFC20E",
    icon: Meh,
    iconColor: "#4A3333",
  },
  {
    id: "against",
    title: "Большинство против",
    subtitle: "источники возражают",
    color: "#E2353F",
    icon: Frown,
    iconColor: "#fff",
  },
  {
    id: "flagged",
    title: "С флагами",
    subtitle: "раздуто · старое",
    color: "#FF7A12",
    icon: Flag,
    iconColor: "#fff",
  },
];

/** Нижняя плашка: сколько утверждений в каждой позиции. Клик — фильтр, повторный клик — сброс. */
export function ConsensusBar({ counts, activeFilter, onSelectFilter }: ConsensusBarProps) {
  const total = counts.all;
  return (
    <section className="relative flex shrink-0 flex-col overflow-hidden rounded-[28px] bg-[#FBF8F7] p-6 pb-5 sm:px-6 sm:pt-7 lg:min-h-[255px] [@media(max-height:780px)]:lg:min-h-[220px]">
      <div className="text-[13px] font-semibold text-[#A27C7A]">
        Позиции источников по {total} {plural(total, ["утверждению", "утверждениям", "утверждениям"])}
      </div>
      <div className="mt-0.5 text-base font-black text-[#4A3333] sm:text-[17px]">
        Общего вердикта нет — смотрите каждое утверждение
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {ITEMS.map((it) => {
          const active = activeFilter === it.id;
          const Icon = it.icon;
          return (
            <React.Fragment key={it.id}>
              {it.id === "flagged" && <div className="hidden h-10 w-px bg-[#E3D9D6] min-[1440px]:block" />}
              <button
                type="button"
                onClick={() => onSelectFilter(active ? "all" : it.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-none bg-transparent p-1 text-left transition-colors ${
                  active ? "bg-[#F1EBE9]" : "hover:bg-[#F1EBE9]/70"
                }`}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: it.color }}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.2} style={{ color: it.iconColor }} />
                </span>
                <span className="flex flex-col">
                  <span className="whitespace-nowrap text-[15px] font-extrabold text-[#4A3333]">
                    <span className="mr-1.5 text-[20px] font-black">{counts[it.id]}</span>
                    {it.title}
                  </span>
                  <span className="whitespace-nowrap text-xs font-semibold text-[#A27C7A]">
                    {it.subtitle}
                  </span>
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="relative z-10 mt-auto flex items-center gap-2 pt-6 text-xs font-semibold text-[#A27C7A] min-[1440px]:pr-[300px]">
        <MousePointerClick className="h-4 w-4 shrink-0" />
        Каждое утверждение кликабельно — откроются источники и цепочка пересказов
      </div>

      <CornerEmojis />
    </section>
  );
}
