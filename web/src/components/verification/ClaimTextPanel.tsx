import React from "react";
import type { ClaimConsensus, FactCheck } from "@news/contracts";

export interface ClaimTextPanelProps {
  factChecks: FactCheck[];
  selectedClaimId: string;
  onSelectClaimId: (id: string) => void;
  /** Утверждения, не подходящие под фильтр, приглушаются */
  isDimmed: (fc: FactCheck) => boolean;
}

/** Подсветка утверждения по позиции источников: фон + подчёркивание */
const TONE: Record<ClaimConsensus, { bg: string; line: string }> = {
  converge: { bg: "#E6F7F0", line: "#1DA57A" },
  split: { bg: "#FFF4D1", line: "#FFC20E" },
  against: { bg: "#FDE3E5", line: "#E2353F" },
  flagged: { bg: "#FFE7D3", line: "#FF7A12" },
  unverifiable: { bg: "#EEE8E6", line: "#A27C7A" },
};

/** «Вчера сгорел…» → Вчера сгорел… — кавычки и обрыв цитаты в тексте не нужны */
function cleanQuote(quote: string): string {
  return quote
    .replace(/^[«"“]+|[»"”]+$/g, "")
    .replace(/\.{3}|…$/g, "")
    .trim();
}

/**
 * «Текст, который спросили»: утверждения в тексте подсвечены и кликабельны.
 * TODO(frontend): когда бэкенд начнёт отдавать исходный текст, подсвечивать утверждения внутри него.
 * Пока текст собирается из дословных цитат утверждений.
 */
export function ClaimTextPanel({
  factChecks,
  selectedClaimId,
  onSelectClaimId,
  isDimmed,
}: ClaimTextPanelProps) {
  return (
    <section className="flex min-h-[280px] flex-1 flex-col rounded-[28px] bg-[#FBF8F7] p-6 sm:p-[30px] lg:min-h-0">
      <h2 className="shrink-0 text-lg font-black uppercase tracking-[-0.2px] text-[#4A3333] sm:text-[20px]">
        Текст который спросили
      </h2>

      {/* запас p-1 под обводку выбранного утверждения (ring выходит за кнопку, overflow её обрезает);
          -mx-1 и mt-4 вместо mt-5 — чтобы текст остался на месте */}
      <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto p-1">
        {/* flex с зазорами, а не строки текста: подсветки не касаются, обводка выбранного не наезжает на соседей */}
        <div className="flex flex-wrap items-start gap-x-1.5 gap-y-3 text-[17px] font-semibold leading-[1.6] text-[#4A3333] sm:text-[19px]">
          {factChecks.map((fc) => {
            const tone = TONE[fc.consensus] ?? TONE.unverifiable;
            const selected = fc.id === selectedClaimId;
            return (
              <React.Fragment key={fc.id}>
                <button
                  type="button"
                  onClick={() => onSelectClaimId(fc.id)}
                  className={`cursor-pointer rounded-md border-none px-1.5 py-1 text-left font-[inherit] leading-[inherit] text-inherit underline decoration-[3px] underline-offset-[6px] transition-all [box-decoration-break:clone] ${
                    isDimmed(fc) ? "opacity-35" : ""
                  } ${selected ? "ring-2 ring-offset-1" : "hover:brightness-95"}`}
                  style={{
                    backgroundColor: tone.bg,
                    textDecorationColor: tone.line,
                    ["--tw-ring-color" as string]: tone.line,
                  }}
                >
                  {cleanQuote(fc.quote)}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
