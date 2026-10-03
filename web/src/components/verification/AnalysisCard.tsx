import React from "react";
import type {
  ClaimConsensus,
  JobId,
  ClaimFlag,
  FactCheck,
  ProvenanceNodeRole,
  ProvenancePathStep,
  SourceStance,
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
  Landmark,
  Link,
  Meh,
  Newspaper,
  Play,
  Send,
  Smile,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AssistantChat } from "./AssistantChat";
import { plural, type ClaimFilter, type FilterCounts } from "./filters";
import { MATERIAL_LABEL, hasProvenanceTree, publicationNodes, type MaterialKind } from "./material";

export interface AnalysisCardProps {
  /** Для чата по разбору: один чат на утверждение этой проверки */
  jobId: JobId;
  factCheck: FactCheck | undefined;
  totalClaims: number;
  totalSources: number;
  counts: FilterCounts;
  activeFilter: ClaimFilter;
  onFilterChange: (filter: ClaimFilter) => void;
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
  counts,
  activeFilter,
  onFilterChange,
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

        <div className="mt-4 flex flex-wrap gap-1.5 [@media(max-height:780px)]:mt-3">
          <FilterPill
            id="converge"
            label="Сходятся"
            dot="#1DA57A"
            {...{ counts, activeFilter, onFilterChange }}
          />
          <FilterPill
            id="split"
            label="Разделились"
            dot="#FFC20E"
            {...{ counts, activeFilter, onFilterChange }}
          />
          <FilterPill
            id="against"
            label="Большинство против"
            dot="#E2353F"
            {...{ counts, activeFilter, onFilterChange }}
          />
          <FilterPill id="all" label="Все" {...{ counts, activeFilter, onFilterChange }} />
          <FilterPill
            id="exaggerated"
            label="Раздуто"
            icon={TrendingUp}
            iconColor="#FF7A12"
            {...{ counts, activeFilter, onFilterChange }}
          />
          <FilterPill
            id="outdated"
            label="Старый контент"
            icon={History}
            iconColor="#6E1EF0"
            {...{ counts, activeFilter, onFilterChange }}
          />
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

function ClaimDetails({
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

  return (
    <div className="flex flex-col gap-2 rounded-[24px] bg-[#F1EBE9] p-3 [@media(max-height:780px)]:gap-1.5 [@media(max-height:780px)]:p-2">
      {flags.length > 0 ? (
        flags.map((flag) => (
          <FlagRow
            key={`${flag.type}:${flag.label}:${flag.detail}`}
            flag={flag}
            onClick={tree ? onOpenProvenanceTree : undefined}
          />
        ))
      ) : (
        <ConsensusRow factCheck={factCheck} />
      )}

      {tree?.pathSummary?.length ? (
        <PathCard
          steps={tree.pathSummary}
          roles={new Map(tree.nodes.map((n) => [n.name, n.role]))}
          material={material}
        />
      ) : null}
      {/* «Большинство против» без доказательств не показываем: опровергающие источники — всегда */}
      {(!tree?.pathSummary?.length || factCheck.consensus === "against") && (
        <SourcesCard factCheck={factCheck} />
      )}

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

const CONSENSUS_STYLE: Record<
  ClaimConsensus,
  { title: string; color: string; icon: LucideIcon; bg: string }
> = {
  converge: { title: "Сходятся", color: "#1DA57A", icon: Smile, bg: "#DDF3EA" },
  split: { title: "Разделились", color: "#FFC20E", icon: Meh, bg: "#FFF1C9" },
  against: { title: "Большинство против", color: "#E2353F", icon: Frown, bg: "#FCDFE1" },
  flagged: { title: "С флагами", color: "#FF7A12", icon: Flag, bg: "#FFE1C7" },
  unverifiable: { title: "Мало источников", color: "#A27C7A", icon: Meh, bg: "#EEE8E6" },
};

function ConsensusRow({ factCheck }: { factCheck: FactCheck }) {
  if (factCheck.status === "checking") {
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

  const st = CONSENSUS_STYLE[factCheck.consensus] ?? CONSENSUS_STYLE.unverifiable;
  const Icon = st.icon;
  const detail = factCheck.keyFinding?.title ?? factCheck.consensusSummary ?? "";
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2.5 pr-4" style={{ backgroundColor: st.bg }}>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: st.color }}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>
      <span className="min-w-0 text-[13px] text-[#4A3333]">
        <b className="font-black">{st.title}</b>
        {detail && <span className="font-semibold">: {detail}</span>}
      </span>
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
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A27C7A]">
          <span className="h-[3px] w-3.5 rounded-full bg-[#FF7A12]" />
          искажение
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
              {i > 0 && (
                <span
                  className="absolute right-[calc(50%+25px)] top-[16px] w-[calc(100%-50px)] rounded-full"
                  style={{
                    height: s.isDistortion ? 3 : 2,
                    backgroundColor: s.isDistortion ? "#FF7A12" : "#E3D9D6",
                  }}
                />
              )}
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

const STANCE: Record<SourceStance, { label: string; color: string }> = {
  supports: { label: "подтверждает", color: "#1DA57A" },
  refutes: { label: "опровергает", color: "#E2353F" },
  mixed: { label: "частично", color: "#FFC20E" },
  neutral: { label: "нейтрально", color: "#A27C7A" },
};

/** Утверждение без дерева первоисточника — показываем его источники с позициями */
function SourcesCard({ factCheck }: { factCheck: FactCheck }) {
  if (!factCheck.sources.length) {
    return (
      <div className="rounded-[18px] bg-[#FBF8F7] p-4 text-[13px] font-semibold text-[#A27C7A]">
        {factCheck.status === "checking"
          ? "Ищем источники в поисковиках и проверяем позиции…"
          : "Источники по этому утверждению пока не найдены"}
      </div>
    );
  }
  // при «против» сначала опровергающие, при «сходятся» — подтверждающие: это доказательства итога
  const lead: SourceStance | undefined =
    factCheck.consensus === "against" ? "refutes" : factCheck.consensus === "converge" ? "supports" : undefined;
  const sources = lead
    ? [...factCheck.sources].sort((a, b) => Number(b.stance === lead) - Number(a.stance === lead))
    : factCheck.sources;
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#FBF8F7] p-3.5">
      <span className="px-0.5 text-[13px] font-extrabold text-[#4A3333]">Источники</span>
      {sources.slice(0, 4).map((src) => {
        const st = STANCE[src.stance];
        return (
          <a
            key={src.id}
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2.5 rounded-xl px-0.5 no-underline hover:bg-[#F1EBE9]/60"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: st.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold text-[#4A3333]">
                {src.publisher}
              </span>
              <span className="line-clamp-2 text-[12px] font-semibold text-[#A27C7A]">{src.snippet}</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold" style={{ color: st.color }}>
              {st.label}
            </span>
          </a>
        );
      })}
    </div>
  );
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

function FilterPill({
  id,
  label,
  dot,
  icon: Icon,
  iconColor,
  counts,
  activeFilter,
  onFilterChange,
}: {
  id: ClaimFilter;
  label: string;
  dot?: string;
  icon?: LucideIcon;
  iconColor?: string;
  counts: FilterCounts;
  activeFilter: ClaimFilter;
  onFilterChange: (f: ClaimFilter) => void;
}) {
  const active = activeFilter === id;
  return (
    <button
      type="button"
      onClick={() => onFilterChange(active && id !== "all" ? "all" : id)}
      className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-2 py-1 text-[12px] font-extrabold transition-colors ${
        active
          ? "border-[#4A3333] bg-[#4A3333] text-white"
          : "border-[#E3D9D6] bg-[#FBF8F7] text-[#4A3333] hover:bg-white"
      }`}
    >
      {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
      {Icon && <Icon className="h-3.5 w-3.5" style={{ color: active ? "#fff" : iconColor }} />}
      {label} {counts[id]}
    </button>
  );
}
