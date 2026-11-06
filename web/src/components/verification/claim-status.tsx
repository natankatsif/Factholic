/**
 * Как показать результат проверки утверждения — одинаково в ленте «Разбор» и в плеере:
 * плашка позиции источников (с долей «за»), флаги одной фразой, пояснение в одну строку.
 */
import React from "react";
import type { ClaimConsensus, FactCheck } from "@news/contracts";
import { Flag, History, TrendingUp, type LucideIcon } from "lucide-react";
import { useSiteText, type SiteDictionary } from "../../i18n/site";
import { formatCountdown, useCountdown } from "../../lib/use-countdown";

/** Плашка позиции: не вывод «правда/ложь», а что говорят источники */
const PILL: Record<ClaimConsensus, { dot: string; bg: string }> = {
  converge: { dot: "#1DA57A", bg: "#DDF3EA" },
  split: { dot: "#FFC20E", bg: "#FFF1C9" },
  against: { dot: "#E2353F", bg: "#FCDFE1" },
  flagged: { dot: "#6E1EF0", bg: "#E8DCFD" },
  unverifiable: { dot: "#A27C7A", bg: "#EEE8E6" },
};

export function StatusPill({ factCheck: fc }: { factCheck: FactCheck }) {
  const t = useSiteText();
  const base =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-extrabold";
  if (fc.status === "found") {
    return (
      <span className={`${base} border border-dashed border-[#C9B8B6] bg-transparent text-[#8C7471]`}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#C9B8B6]" />
        {t.status.notChecked}
      </span>
    );
  }
  if (fc.status === "checking") return <CheckingPill id={fc.id} className={base} />;
  if (fc.status === "failed") {
    return <span className={`${base} bg-[#EEE8E6] text-[#8C7471]`}>{t.status.failed}</span>;
  }
  // фиолетовая плашка — только серьёзные флаги (consensus "flagged"); мягкие («убрана ссылка») — внутри строки
  const major = uniqueFlags(fc).filter(isMajorFlag);
  if (fc.consensus === "flagged" && major.length > 0) {
    return <span className={`${base} bg-[#E8DCFD] text-[#4A3333]`}>{flagsLabel(major, t)}</span>;
  }
  const consensus = fc.consensus in PILL ? fc.consensus : "unverifiable";
  const st = PILL[consensus];
  const share = supportShare(fc, t);
  return (
    <span
      className={`${base} text-[#4A3333]`}
      style={{ backgroundColor: st.bg }}
      title={share ? share.title : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
      {t.status.pill[consensus]}
      {share && <span className="font-black tabular-nums">· {t.status.percentFor(share.percent)}</span>}
    </span>
  );
}

/** Примерно столько длится проверка одного утверждения, секунд: поиск, дерево, стороны */
export const CHECK_ESTIMATE_SEC = 60;

/** «Проверяем… ~0:42»: время примерное, вышло — говорим, что осталось немного */
function CheckingPill({ id, className }: { id: string; className: string }) {
  const t = useSiteText();
  const left = useCountdown(`claim:${id}`, CHECK_ESTIMATE_SEC);
  return (
    <span className={`${className} bg-[#EEE8E6] tabular-nums text-[#8C7471]`}>
      <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[#A27C7A] border-t-transparent" />
      {left > 0 ? t.status.checkingLeft(formatCountdown(left)) : t.status.checkingAlmost}
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
function supportShare(fc: FactCheck, t: SiteDictionary): { percent: number; title: string } | null {
  const sides = fc.sides ?? {
    for: fc.sources.filter((s) => s.stance === "supports").length,
    against: fc.sources.filter((s) => s.stance === "refutes").length,
    mixed: fc.sources.filter((s) => s.stance === "mixed").length,
  };
  const total = sides.for + sides.against + sides.mixed;
  if (total < MIN_POSITIONS_FOR_SHARE) return null;
  const percent = Math.round(((sides.for + sides.mixed / 2) / total) * 100);
  const unit = t.plural(total, fc.sides ? t.words.independentSourcesOf : t.words.publicationsOf);
  const parts = [t.status.shareFor(sides.for), t.status.shareAgainst(sides.against)];
  if (sides.mixed) parts.push(t.status.shareMixed(sides.mixed));
  return { percent, title: t.status.shareTitle(total, unit, parts.join(", ")) };
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

/** Подпись серьёзного искажения на всех языках отчёта (backend/src/stages/09-report/texts.ts) */
const DISTORTION_LABELS = new Set(["Искажение", "Denaturare", "Distortion"]);

/** Серьёзный флаг — как в этапе 09: старое за новое, цифры в разы, сдвиг места / времени / цифр */
function isMajorFlag(f: ClaimFlag): boolean {
  return f.type === "outdated" || f.type === "exaggerated" || DISTORTION_LABELS.has(f.label);
}

/** Итог «подтверждает / опровергает первоисточник» из этапа 09: на любом языке отчёта */
export const ROOT_SUMMARY = /первоисточник|sursa primară|primary source/i;

/** «Старая новость, цифры раздуты» — не больше двух */
function flagsLabel(flags: ClaimFlag[], t: SiteDictionary): string {
  const parts = [
    ...new Set(
      flags.map((f) =>
        f.type === "outdated"
          ? t.status.flagOld
          : f.type === "exaggerated"
            ? t.status.flagInflated
            : f.label.toLowerCase(),
      ),
    ),
  ].slice(0, 2);
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Флаг одной фразой: «Было 2 пострадавших, стало 200», «Событию 3,5 года — в видео подано как недавнее» */
export function flagText(f: ClaimFlag, fc: FactCheck, t: SiteDictionary): string {
  if (f.type === "outdated" && fc.keyFinding?.subtitle) {
    return `${fc.keyFinding.title} — ${fc.keyFinding.subtitle}`;
  }
  const [before, after] = f.detail.split(" → ");
  if (f.type === "exaggerated" && before && after) return t.status.wasBecame(before, after);
  return `${f.label}: ${f.detail}`;
}

/**
 * Пояснение в одну строку — по найденному, без вывода: кто подтверждает, кто возражает,
 * или почему сказать нечего.
 */
export function summaryLine(fc: FactCheck, t: SiteDictionary): string | null {
  if (fc.status === "found") return t.status.summaryFound;
  if (fc.status === "checking") return t.status.summaryChecking;
  if (fc.status === "failed") return fc.error ?? null;
  if (fc.keyFinding?.subtitle && fc.consensus === "unverifiable") {
    return `${fc.keyFinding.title}: ${fc.keyFinding.subtitle}`;
  }
  if (fc.consensusSummary && ROOT_SUMMARY.test(fc.consensusSummary)) return capitalize(fc.consensusSummary);

  const names = (stance: FactCheck["sources"][number]["stance"]) => [
    ...new Set(fc.sources.filter((s) => s.stance === stance).map((s) => s.publisher)),
  ];
  const pro = names("supports");
  const contra = names("refutes");
  if (pro.length && contra.length) return t.status.summarySides(list(pro, 2, t), list(contra, 2, t));
  // глагол уже на плашке — здесь только кто именно
  if (contra.length) return t.status.summarySources(list(contra, 3, t));
  if (pro.length) return t.status.summarySources(list(pro, 3, t));
  if (fc.sources.length) {
    return t.status.summaryNoStance(list([...new Set(fc.sources.map((s) => s.publisher))], 2, t));
  }
  return t.status.noPublications;
}

/** «DW, Reuters и ещё 2» */
function list(items: string[], max: number, t: SiteDictionary): string {
  if (items.length <= max) return items.join(", ");
  return t.status.listMore(items.slice(0, max).join(", "), items.length - max);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Флаги списком: иконка и фраза («Было 2 пострадавших, стало 200») */
export function FlagList({ factCheck: fc, className = "" }: { factCheck: FactCheck; className?: string }) {
  const t = useSiteText();
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
            {flagText(f, fc, t)}
          </li>
        );
      })}
    </ul>
  );
}
