/**
 * Как показать результат проверки утверждения — одинаково в ленте «Разбор» и в плеере:
 * плашка позиции источников (с долей «за»), флаги одной фразой, пояснение в одну строку.
 */
import React from "react";
import type { ClaimConsensus, FactCheck } from "@news/contracts";
import { Flag, History, TrendingUp, type LucideIcon } from "lucide-react";
import { plural } from "./filters";

/** Плашка позиции: не вывод «правда/ложь», а что говорят источники */
const PILL: Record<ClaimConsensus, { label: string; dot: string; bg: string }> = {
  converge: { label: "Подтверждают", dot: "#1DA57A", bg: "#DDF3EA" },
  split: { label: "Источники спорят", dot: "#FFC20E", bg: "#FFF1C9" },
  against: { label: "Говорят обратное", dot: "#E2353F", bg: "#FCDFE1" },
  flagged: { label: "С флагами", dot: "#6E1EF0", bg: "#E8DCFD" },
  unverifiable: { label: "Мало данных", dot: "#A27C7A", bg: "#EEE8E6" },
};

export function StatusPill({ factCheck: fc }: { factCheck: FactCheck }) {
  const base =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-extrabold";
  if (fc.status === "found") {
    return (
      <span className={`${base} border border-dashed border-[#C9B8B6] bg-transparent text-[#8C7471]`}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#C9B8B6]" />
        Не проверено
      </span>
    );
  }
  if (fc.status === "checking") {
    return (
      <span className={`${base} bg-[#EEE8E6] text-[#8C7471]`}>
        <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[#A27C7A] border-t-transparent" />
        Проверяем…
      </span>
    );
  }
  if (fc.status === "failed") {
    return <span className={`${base} bg-[#EEE8E6] text-[#8C7471]`}>Не удалось проверить</span>;
  }
  // фиолетовая плашка — только серьёзные флаги (consensus "flagged"); мягкие («убрана ссылка») — внутри строки
  const major = uniqueFlags(fc).filter(isMajorFlag);
  if (fc.consensus === "flagged" && major.length > 0) {
    return <span className={`${base} bg-[#E8DCFD] text-[#4A3333]`}>{flagsLabel(major)}</span>;
  }
  const st = PILL[fc.consensus] ?? PILL.unverifiable;
  const share = supportShare(fc);
  return (
    <span
      className={`${base} text-[#4A3333]`}
      style={{ backgroundColor: st.bg }}
      title={share ? share.title : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
      {st.label}
      {share && <span className="font-black tabular-nums">· {share.percent}% за</span>}
    </span>
  );
}

/** Меньше стольких позиций — процент не показываем: один-два голоса не доля, а случайность */
const MIN_POSITIONS_FOR_SHARE = 2;

/**
 * Доля «за» среди источников с позицией: 80% — почти все подтверждают, 10% — почти все возражают.
 * Считается по независимым группам (перепечатки одной новости — один голос), «частично» — полголоса.
 * Старый отчёт без sides — по публикациям.
 */
function supportShare(fc: FactCheck): { percent: number; title: string } | null {
  const sides = fc.sides ?? {
    for: fc.sources.filter((s) => s.stance === "supports").length,
    against: fc.sources.filter((s) => s.stance === "refutes").length,
    mixed: fc.sources.filter((s) => s.stance === "mixed").length,
  };
  const total = sides.for + sides.against + sides.mixed;
  if (total < MIN_POSITIONS_FOR_SHARE) return null;
  const percent = Math.round(((sides.for + sides.mixed / 2) / total) * 100);
  const unit = fc.sides
    ? plural(total, ["независимого источника", "независимых источников", "независимых источников"])
    : plural(total, ["публикации", "публикаций", "публикаций"]);
  const parts = [`за — ${sides.for}`, `против — ${sides.against}`];
  if (sides.mixed) parts.push(`частично — ${sides.mixed} (полголоса)`);
  return { percent, title: `Из ${total} ${unit} с позицией: ${parts.join(", ")}` };
}

export const FLAG_ICON: Record<FactCheck["flags"][number]["type"], { icon: LucideIcon; color: string }> = {
  outdated: { icon: History, color: "#6E1EF0" },
  exaggerated: { icon: TrendingUp, color: "#FF7A12" },
  distortion: { icon: TrendingUp, color: "#FF7A12" },
  other: { icon: Flag, color: "#A27C7A" },
};

export type ClaimFlag = FactCheck["flags"][number];

/** Бэкенд может прислать один флаг дважды (одна мутация на двух рёбрах дерева) */
export function uniqueFlags(fc: FactCheck): ClaimFlag[] {
  return fc.flags.filter(
    (f, i, all) =>
      all.findIndex((g) => g.type === f.type && g.label === f.label && g.detail === f.detail) === i,
  );
}

/** Серьёзный флаг — как в этапе 09: старое за новое, цифры в разы, сдвиг места / времени / цифр */
function isMajorFlag(f: ClaimFlag): boolean {
  return f.type === "outdated" || f.type === "exaggerated" || f.label === "Искажение";
}

/** «Старая новость, цифры раздуты» — не больше двух */
function flagsLabel(flags: ClaimFlag[]): string {
  const parts = [
    ...new Set(
      flags.map((f) =>
        f.type === "outdated"
          ? "старая новость"
          : f.type === "exaggerated"
            ? "цифры раздуты"
            : f.label.toLowerCase(),
      ),
    ),
  ].slice(0, 2);
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Флаг одной фразой: «Было 2 пострадавших, стало 200», «Событию 3,5 года — в видео подано как недавнее» */
export function flagText(f: ClaimFlag, fc: FactCheck): string {
  if (f.type === "outdated" && fc.keyFinding?.subtitle) {
    return `${fc.keyFinding.title} — ${fc.keyFinding.subtitle}`;
  }
  const [before, after] = f.detail.split(" → ");
  if (f.type === "exaggerated" && before && after) return `Было ${before}, стало ${after}`;
  return `${f.label}: ${f.detail}`;
}

/**
 * Пояснение в одну строку — по найденному, без вывода: кто подтверждает, кто возражает,
 * или почему сказать нечего.
 */
export function summaryLine(fc: FactCheck): string | null {
  if (fc.status === "found") return "Проверим, когда видео подойдёт · нажмите, чтобы проверить сейчас";
  if (fc.status === "checking") return "Ищем источники и позиции…";
  if (fc.status === "failed") return fc.error ?? null;
  if (fc.keyFinding?.subtitle && fc.consensus === "unverifiable") {
    return `${fc.keyFinding.title}: ${fc.keyFinding.subtitle}`;
  }
  if (fc.consensusSummary?.includes("первоисточник")) return capitalize(fc.consensusSummary);

  const names = (stance: FactCheck["sources"][number]["stance"]) => [
    ...new Set(fc.sources.filter((s) => s.stance === stance).map((s) => s.publisher)),
  ];
  const pro = names("supports");
  const contra = names("refutes");
  if (pro.length && contra.length) return `За: ${list(pro, 2)} · против: ${list(contra, 2)}`;
  // глагол уже на плашке — здесь только кто именно
  if (contra.length) return `Источники: ${list(contra, 3)}`;
  if (pro.length) return `Источники: ${list(pro, 3)}`;
  if (fc.sources.length) {
    return `Писали ${list([...new Set(fc.sources.map((s) => s.publisher))], 2)}, без явной позиции`;
  }
  return "Публикаций об этом не нашли";
}

/** «DW, Reuters и ещё 2» */
function list(items: string[], max: number): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} и ещё ${items.length - max}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Флаги списком: иконка и фраза («Было 2 пострадавших, стало 200») */
export function FlagList({ factCheck: fc, className = "" }: { factCheck: FactCheck; className?: string }) {
  const flags = uniqueFlags(fc);
  if (fc.status !== "done" || flags.length === 0) return null;
  return (
    <ul className={`m-0 flex list-none flex-col gap-1 p-0 ${className}`}>
      {flags.map((f) => {
        const st = FLAG_ICON[f.type] ?? FLAG_ICON.other;
        const Icon = st.icon;
        return (
          <li
            key={`${f.type}:${f.label}:${f.detail}`}
            className="flex items-start gap-2 text-[13px] font-semibold leading-snug"
          >
            <Icon className="mt-[2px] h-3.5 w-3.5 shrink-0" style={{ color: st.color }} />
            {flagText(f, fc)}
          </li>
        );
      })}
    </ul>
  );
}
