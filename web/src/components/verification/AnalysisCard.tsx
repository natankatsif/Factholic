import React, { useState } from "react";
import {
  isPendingCheck,
  type ClaimConsensus,
  type ClaimSides,
  type JobId,
  type ClaimFlag,
  type FactCheck,
  type ProvenanceNodeRole,
  type ProvenancePathStep,
  type SourceStance,
} from "@news/contracts";
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Ellipsis,
  FileText,
  Flag,
  Frown,
  GitFork,
  Globe,
  History,
  Info,
  Landmark,
  Link,
  Meh,
  Newspaper,
  Play,
  SearchX,
  Send,
  TriangleAlert,
  Smile,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AssistantChat } from "./AssistantChat";
import { plural } from "./filters";
import { MATERIAL_LABEL, hasProvenanceTree, publicationNodes, type MaterialKind } from "./material";

export interface AnalysisCardProps {
  /** Для чата по разбору: один чат на утверждение этой проверки */
  jobId: JobId;
  factCheck: FactCheck | undefined;
  totalClaims: number;
  totalSources: number;
  onOpenProvenanceTree: () => void;
  suggestedQuestions?: string[];
  /** Что проверяем — от этого подпись и иконка последнего узла цепочки («Это видео» / «Этот текст» / …) */
  material?: MaterialKind;
}

/** Правая колонка «Разбор»: сводка и фильтры, детали выбранного утверждения, вопросы ассистенту. */
export function AnalysisCard({
  jobId,
  factCheck,
  totalClaims,
  totalSources,
  onOpenProvenanceTree,
  suggestedQuestions,
  material = "video",
}: AnalysisCardProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-[#FBF8F7]">
      {/* Заголовок, счётчики, фильтры */}
      <div className="shrink-0 px-6 pt-6 [@media(max-height:780px)]:pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-black leading-tight text-[#4A3333]">Разбор</h2>
            <div className="mt-1 flex gap-4 text-[13px] font-semibold text-[#A27C7A]">
              <span>
                <b className="mr-1 text-[15px] font-black text-[#4A3333]">{totalClaims}</b>
                {plural(totalClaims, ["утверждение", "утверждения", "утверждений"])}
              </span>
              <span>
                <b className="mr-1 text-[15px] font-black text-[#4A3333]">{totalSources}</b>
                {plural(totalSources, ["источник", "источника", "источников"])}
              </span>
            </div>
          </div>
          {/* TODO(frontend): скачать отчёт и меню действий */}
          <div className="flex gap-2">
            <RoundButton icon={Download} title="Скачать отчёт" />
            <RoundButton icon={Ellipsis} title="Ещё" />
          </div>
        </div>
      </div>

      <div className="mt-4 h-px shrink-0 bg-[#E3D9D6] [@media(max-height:780px)]:mt-3" />

      {/* Чат: карточка выбранного утверждения — первое сообщение, ниже вопросы и ответы ассистента */}
      {factCheck ? (
        <AssistantChat
          key={factCheck.id}
          jobId={jobId}
          claimId={factCheck.id}
          suggestedQuestions={suggestedQuestions}
          intro={
            <ClaimDetails
              factCheck={factCheck}
              material={material}
              onOpenProvenanceTree={onOpenProvenanceTree}
            />
          }
        />
      ) : (
        <p className="p-6 text-sm font-semibold text-[#A27C7A]">Нет утверждений под этот фильтр</p>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------

export function ClaimDetails({
  factCheck,
  material,
  onOpenProvenanceTree,
}: {
  factCheck: FactCheck;
  material: MaterialKind;
  onOpenProvenanceTree: () => void;
}) {
  // без связей дерева нет (публикаций не нашлось или они только на ту же тему) — показываем источники поиска
  const tree = hasProvenanceTree(factCheck.provenance) ? factCheck.provenance : undefined;
  // как в шапке «Разбор»: найденные источники, а не узлы дерева (в нём ещё и сам материал)
  const sourcesCount = factCheck.sources.length || publicationNodes(tree).length;
  // бэкенд может прислать один флаг дважды (одна мутация на двух рёбрах дерева)
  const flags = factCheck.flags.filter(
    (f, i, all) =>
      all.findIndex((g) => g.type === f.type && g.label === f.label && g.detail === f.detail) === i,
  );
  // проверено, а публикаций нет ни в поиске, ни в дереве
  const nothingFound = factCheck.status === "done" && sourcesCount === 0 && !tree;

  return (
    <div className="flex flex-col gap-2 rounded-[24px] bg-[#F1EBE9] p-3 [@media(max-height:780px)]:gap-1.5 [@media(max-height:780px)]:p-2">
      {flags.map((flag) => (
        <FlagRow
          key={`${flag.type}:${flag.label}:${flag.detail}`}
          flag={flag}
          onClick={tree ? onOpenProvenanceTree : undefined}
        />
      ))}

      {/* Стороны: счёт, а не вывод — кто подтверждает, кто возражает; решает читатель.
          Публикаций нет вовсе — одна понятная карточка вместо нулевых счётчиков и пустых списков */}
      {isPendingCheck(factCheck) ? (
        <CheckingRow />
      ) : factCheck.status === "failed" ? (
        <FailedCard factCheck={factCheck} />
      ) : nothingFound ? (
        <NothingFoundCard factCheck={factCheck} />
      ) : (
        <SidesCard factCheck={factCheck} />
      )}

      {tree?.pathSummary?.length ? (
        <PathCard
          steps={tree.pathSummary}
          roles={new Map(tree.nodes.map((n) => [n.name, n.role]))}
          material={material}
        />
      ) : null}
      {/* кто что говорит — по сторонам, чтобы счёт сверху можно было проверить по ссылкам */}
      {!nothingFound && factCheck.status !== "failed" && <SourcesCard factCheck={factCheck} />}

      {(sourcesCount > 0 || tree) && (
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <span className="text-[13px] font-extrabold text-[#4A3333]">
            {sourcesCount} {plural(sourcesCount, ["источник", "источника", "источников"])}
          </span>
          {tree && (
            <button
              type="button"
              onClick={onOpenProvenanceTree}
              className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-[#4A3333] px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-[#362424]"
            >
              <GitFork className="h-4 w-4" />
              Открыть дерево источников
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Проверили, а публикаций об утверждении нет. Говорим это один раз и прямо: «не нашли» — не опровержение
 * (принцип «только по найденным публикациям»: мало источников — так и говорим, а не догадываемся).
 */
function NothingFoundCard({ factCheck }: { factCheck: FactCheck }) {
  // бэкенд объясняет, чего не хватило: «Недостаточно информации: нет данных о …»
  const reason = factCheck.consensus === "unverifiable" ? factCheck.keyFinding?.subtitle : undefined;
  return (
    <div className="flex items-start gap-3 rounded-[18px] bg-[#FBF8F7] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEE8E6]">
        <SearchX className="h-[18px] w-[18px] text-[#A27C7A]" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[14px] font-black text-[#4A3333]">Публикаций об этом не нашли</span>
        <span className="text-[13px] font-semibold leading-snug text-[#A27C7A]">
          {reason ??
            "Искали в новостях на румынском, русском и английском. Так бывает, если о событии не писали или в утверждении другие детали — дата, место, цифры."}
        </span>
        <span className="text-[12px] font-bold leading-snug text-[#4A3333]">
          Это не опровержение: сторон нет, потому что не нашлось, кого сравнить.
        </span>
      </div>
    </div>
  );
}

/** Проверка упала (поиск или LLM): говорим, что не смогли, а не «ничего не нашли» */
function FailedCard({ factCheck }: { factCheck: FactCheck }) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] bg-[#FBF8F7] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF1C9]">
        <TriangleAlert className="h-[18px] w-[18px] text-[#E0A800]" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] font-black text-[#4A3333]">Не получилось проверить</span>
        <span className="text-[13px] font-semibold leading-snug text-[#A27C7A]">
          {factCheck.error || "Поиск источников не ответил. Попробуй открыть проверку ещё раз чуть позже."}
        </span>
      </div>
    </div>
  );
}

const FLAG_STYLE: Record<ClaimFlag["type"], { bg: string; circle: string; icon: LucideIcon }> = {
  outdated: { bg: "#E8DCFD", circle: "#6E1EF0", icon: History },
  exaggerated: { bg: "#FFE1C7", circle: "#FF7A12", icon: TrendingUp },
  distortion: { bg: "#FFE1C7", circle: "#FF7A12", icon: TrendingUp },
  other: { bg: "#EEE8E6", circle: "#A27C7A", icon: Flag },
};

function FlagRow({ flag, onClick }: { flag: ClaimFlag; onClick?: () => void }) {
  const st = FLAG_STYLE[flag.type] ?? FLAG_STYLE.other;
  const Icon = st.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border-none p-2.5 pr-4 text-left disabled:cursor-default [@media(max-height:780px)]:py-2"
      style={{ backgroundColor: st.bg }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: st.circle }}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] text-[#4A3333]">
        <b className="font-black">{flag.label}:</b> <span className="font-semibold">{flag.detail}</span>
      </span>
      {onClick && <ArrowUpRight className="h-4 w-4 shrink-0 text-[#4A3333]" />}
    </button>
  );
}

export const CONSENSUS_STYLE: Record<
  ClaimConsensus,
  { title: string; color: string; icon: LucideIcon; bg: string }
> = {
  converge: { title: "В основном подтверждают", color: "#1DA57A", icon: Smile, bg: "#DDF3EA" },
  split: { title: "Разделились", color: "#FFC20E", icon: Meh, bg: "#FFF1C9" },
  against: { title: "В основном возражают", color: "#E2353F", icon: Frown, bg: "#FCDFE1" },
  flagged: { title: "С флагами", color: "#FF7A12", icon: Flag, bg: "#FFE1C7" },
  unverifiable: { title: "Мало источников", color: "#A27C7A", icon: Meh, bg: "#EEE8E6" },
};

function CheckingRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#FFF4D1] p-2.5 pr-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFC20E]">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </span>
      <span className="min-w-0 text-[13px] text-[#4A3333]">
        <b className="font-black">Проверяем утверждение…</b>
        <span className="ml-1.5 font-semibold text-[#A27C7A]">ищем подтверждения и опровержения</span>
      </span>
    </div>
  );
}

/** Три стороны в одном порядке везде: сначала подтверждающие, потом возражающие, потом «частично» */
const SIDES: { key: keyof ClaimSides; stance: SourceStance; label: string; color: string; bg: string }[] = [
  { key: "for", stance: "supports", label: "Подтверждают", color: "#1DA57A", bg: "#DDF3EA" },
  { key: "against", stance: "refutes", label: "Возражают", color: "#E2353F", bg: "#FCDFE1" },
  { key: "mixed", stance: "mixed", label: "Частично", color: "#E0A800", bg: "#FFF1C9" },
];

/**
 * Счёт сторон по независимым группам источников (перепечатки одной новости — один голос).
 * Старый отчёт без sides — считаем по публикациям и честно подписываем, что перепечатки не учтены.
 */
function SidesCard({ factCheck }: { factCheck: FactCheck }) {
  const byGroups = Boolean(factCheck.sides);
  const sides: ClaimSides = factCheck.sides ?? {
    for: factCheck.sources.filter((s) => s.stance === "supports").length,
    against: factCheck.sources.filter((s) => s.stance === "refutes").length,
    mixed: factCheck.sources.filter((s) => s.stance === "mixed").length,
  };
  const total = sides.for + sides.against + sides.mixed;
  const st = CONSENSUS_STYLE[factCheck.consensus] ?? CONSENSUS_STYLE.unverifiable;
  // «Недостаточно информации: …», «подтверждает первоисточник: ООН» — пояснение к счёту
  const note =
    factCheck.keyFinding?.subtitle && factCheck.consensus === "unverifiable"
      ? `${factCheck.keyFinding.title}: ${factCheck.keyFinding.subtitle}`
      : factCheck.consensusSummary?.includes("первоисточник")
        ? factCheck.consensusSummary
        : undefined;
  const unit: [string, string, string] = byGroups
    ? ["независимый источник", "независимых источника", "независимых источников"]
    : ["публикация", "публикации", "публикаций"];

  // публикации есть, но ни одна не подтверждает и не опровергает — нулевые счётчики ничего не добавят
  if (total === 0) {
    return (
      <div className="flex items-start gap-2 rounded-[18px] bg-[#FBF8F7] p-3.5 text-[13px] font-semibold leading-snug text-[#A27C7A]">
        <Info className="mt-[2px] h-4 w-4 shrink-0" />
        <span>
          <b className="font-black text-[#4A3333]">Сторон нет.</b> Публикации на эту тему нашли, но ни одна
          прямо не подтверждает и не опровергает утверждение.
          {note && <span className="mt-1 block text-[#4A3333]">{note}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-[#FBF8F7] p-3.5">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span className="text-[13px] font-extrabold text-[#4A3333]">Что говорят источники</span>
        {total >= 2 && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
            style={{ backgroundColor: st.bg, color: "#4A3333" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
            {st.title}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {SIDES.map((side) => {
          const n = sides[side.key];
          return (
            <div
              key={side.key}
              className="flex flex-col items-center rounded-2xl py-2.5"
              style={{ backgroundColor: n ? side.bg : "#F1EBE9" }}
            >
              <span
                className="text-[22px] font-black leading-none tabular-nums"
                style={{ color: n ? side.color : "#C9B8B6" }}
              >
                {n}
              </span>
              <span className={`mt-1 text-[11px] font-extrabold ${n ? "text-[#4A3333]" : "text-[#A27C7A]"}`}>
                {side.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* доли сторон одной полосой */}
      <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
        {SIDES.filter((side) => sides[side.key] > 0).map((side) => (
          <span
            key={side.key}
            className="h-full rounded-full"
            style={{ flexGrow: sides[side.key], backgroundColor: side.color }}
          />
        ))}
      </div>

      <p className="m-0 flex items-start gap-1.5 px-0.5 text-[12px] font-semibold leading-snug text-[#A27C7A]">
        <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        <span>
          {total === 1
            ? `Нашли только ${byGroups ? "один независимый источник" : "одну публикацию"} с позицией — делать вывод рано`
            : `${total} ${plural(total, unit)}${
                byGroups
                  ? " · перепечатки одной новости считаются одним голосом"
                  : " · перепечатки не объединены"
              }`}
          {note && <span className="block text-[#4A3333]">{note}</span>}
        </span>
      </p>
    </div>
  );
}

const ROLE_STYLE: Record<ProvenanceNodeRole, { icon: LucideIcon; bg: string; fg: string }> = {
  primary: { icon: Newspaper, bg: "#EDE4FD", fg: "#6E1EF0" },
  retelling: { icon: Globe, bg: "#EEE8E6", fg: "#8C7471" },
  confirmation: { icon: Landmark, bg: "#DDF3EA", fg: "#1DA57A" },
  distortion: { icon: Send, bg: "#FFE7D3", fg: "#FF7A12" },
  target: { icon: Play, bg: "#FFE7D3", fg: "#FF7A12" },
};

const MATERIAL_ICON: Record<MaterialKind, LucideIcon> = { video: Play, text: FileText, article: Link };

/**
 * «Путь утверждения»: кружки-узлы с иконкой роли, соединения оранжевые там, где искажение.
 * Последний узел — сам проверяемый материал: подпись и иконка по его виду, а не всегда «видео».
 */
function PathCard({
  steps,
  roles,
  material,
}: {
  steps: ProvenancePathStep[];
  roles: Map<string, ProvenanceNodeRole>;
  material: MaterialKind;
}) {
  const roleOf = (s: ProvenancePathStep, i: number): ProvenanceNodeRole =>
    roles.get(s.name) ??
    (i === 0
      ? "primary"
      : i === steps.length - 1 && s.isDistortion
        ? "target"
        : s.isDistortion
          ? "distortion"
          : "retelling");

  return (
    <div className="rounded-[18px] bg-[#FBF8F7] px-3 pb-3.5 pt-3.5 [@media(max-height:780px)]:pb-2.5 [@media(max-height:780px)]:pt-2.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-extrabold text-[#4A3333]">Путь утверждения</span>
        <span className="flex items-center gap-3 text-[11px] font-semibold text-[#A27C7A]">
          {/* разрыв — только если он есть: первоисточник найден, но как дошло дальше — неизвестно */}
          {steps.some((s) => s.linked === false) && (
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 border-t-2 border-dashed border-[#C9B8B6]" />
              связь не установлена
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full bg-[#FF7A12]" />
            искажение
          </span>
        </span>
      </div>

      <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const role = roleOf(s, i);
          const st = ROLE_STYLE[role];
          const isTarget = role === "target";
          const Icon = isTarget ? MATERIAL_ICON[material] : st.icon;
          const name = isTarget ? MATERIAL_LABEL[material] : s.name;
          const tagColor = role === "primary" ? "#6E1EF0" : s.isDistortion ? "#FF7A12" : "#A27C7A";
          return (
            <div key={s.name + i} className="relative flex min-w-0 flex-col items-center px-0.5 text-center">
              {i > 0 &&
                (s.linked === false ? (
                  // разрыв: первоисточник раньше, но связь с этим шагом не установлена — пунктир, не линия
                  <span
                    title="Связь не установлена: первоисточник найден, но как утверждение дошло дальше — неизвестно"
                    className="absolute right-[calc(50%+25px)] top-[16px] w-[calc(100%-50px)] border-t-2 border-dashed border-[#C9B8B6]"
                  />
                ) : (
                  <span
                    className="absolute right-[calc(50%+25px)] top-[16px] w-[calc(100%-50px)] rounded-full"
                    style={{
                      height: s.isDistortion ? 3 : 2,
                      backgroundColor: s.isDistortion ? "#FF7A12" : "#E3D9D6",
                    }}
                  />
                ))}
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
                style={{ backgroundColor: st.bg }}
              >
                <Icon className="h-4 w-4" style={{ color: st.fg }} />
              </span>
              <span className="mt-2 w-full truncate text-[12px] font-black text-[#4A3333]" title={name}>
                {name}
              </span>
              <span className="mt-0.5 text-[11px] font-semibold text-[#A27C7A]">{s.date}</span>
              <span className="mt-1 w-full truncate text-[10.5px] font-extrabold" style={{ color: tagColor }}>
                {s.tag}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Сколько публикаций показывать в стороне до «ещё N» */
const SOURCES_PER_SIDE = 3;

/** Публикации по сторонам: подтверждают / возражают / частично / просто упоминают */
export function SourcesCard({ factCheck }: { factCheck: FactCheck }) {
  if (!factCheck.sources.length) {
    return (
      <div className="rounded-[18px] bg-[#FBF8F7] p-4 text-[13px] font-semibold text-[#A27C7A]">
        {isPendingCheck(factCheck)
          ? "Ищем источники в поисковиках и проверяем позиции…"
          : "Публикаций по этому утверждению не нашли"}
      </div>
    );
  }
  const groups = [
    ...SIDES.map((side) => ({ ...side, sources: factCheck.sources.filter((s) => s.stance === side.stance) })),
    {
      key: "neutral",
      stance: "neutral" as const,
      label: "Упоминают без позиции",
      color: "#A27C7A",
      sources: factCheck.sources.filter((s) => s.stance === "neutral"),
    },
  ];
  // пустую сторону показываем явно, если вторая есть: видно, что искали и подтверждения, и опровержения
  const hasFor = groups[0]!.sources.length > 0;
  const hasAgainst = groups[1]!.sources.length > 0;
  const shown = groups.filter(
    (g) =>
      g.sources.length > 0 || (g.stance === "supports" && hasAgainst) || (g.stance === "refutes" && hasFor),
  );

  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] bg-[#FBF8F7] p-3.5">
      {shown.map((g) => (
        <SourceGroup key={g.key} label={g.label} color={g.color} stance={g.stance} sources={g.sources} />
      ))}
    </div>
  );
}

function SourceGroup({
  label,
  color,
  stance,
  sources,
}: {
  label: string;
  color: string;
  stance: SourceStance;
  sources: FactCheck["sources"];
}) {
  const [open, setOpen] = useState(false);
  const visible = open ? sources : sources.slice(0, SOURCES_PER_SIDE);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 px-0.5 text-[13px] font-extrabold text-[#4A3333]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
        <span className="font-bold text-[#A27C7A]">
          · {sources.length} {plural(sources.length, ["публикация", "публикации", "публикаций"])}
        </span>
      </span>
      {sources.length === 0 ? (
        <span className="pl-[18px] text-[12px] font-semibold text-[#C9B8B6]">
          {stance === "supports" ? "подтверждающих публикаций не нашли" : "возражающих публикаций не нашли"}
        </span>
      ) : (
        visible.map((src) => (
          <a
            key={src.id}
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col rounded-xl py-0.5 pl-[18px] pr-0.5 no-underline hover:bg-[#F1EBE9]/60"
          >
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-extrabold text-[#4A3333]">{src.publisher}</span>
              {formatSourceDate(src.publishedAt) && (
                <span className="shrink-0 text-[11px] font-bold text-[#A27C7A]">
                  {formatSourceDate(src.publishedAt)}
                </span>
              )}
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#C9B8B6]" />
            </span>
            <span className="line-clamp-2 text-[12px] font-semibold text-[#A27C7A]">{src.snippet}</span>
          </a>
        ))
      )}
      {sources.length > SOURCES_PER_SIDE && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="ml-[18px] w-fit cursor-pointer border-none bg-transparent p-0 text-[12px] font-extrabold text-[#1660D6] hover:underline"
        >
          {open ? "Свернуть" : `Ещё ${sources.length - SOURCES_PER_SIDE}`}
        </button>
      )}
    </div>
  );
}

function formatSourceDate(raw: string | undefined): string {
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("ru-RU");
}

// ---------------------------------------------------------------------------

function RoundButton({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-[#F1EBE9] text-[#4A3333] transition-colors hover:bg-[#E3D9D6]"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
