import { z } from "zod";
import type { SourceId, SourceStance } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import type { FoundSource } from "../04-source-search/types.ts";
import { askJson } from "./llm.ts";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { fixedTexts, type FixedStances } from "./texts.ts";
import type { ConsensusStatus, SourceAssessment, StancesInput, StancesOutput } from "./types.ts";

// ===================== ПРАВИЛА ПОДСЧЁТА СТОРОН =====================

/** Голосует только источник по теме: позиция не neutral и relevance не ниже порога показа во фронте */
const MIN_VOTE_RELEVANCE = 0.3;

/**
 * Вклад позиции источника в сумму его группы. Позиция группы — по знаку суммы: > 0 — «за», < 0 — «против»,
 * 0 (только mixed или поровну supports/refutes) — вес группы делится пополам между «за» и «против».
 */
const STANCE_VOTE: Record<Exclude<SourceStance, "neutral">, number> = { supports: 1, refutes: -1, mixed: 0 };

/** Меньше независимых групп с позицией — о сторонах говорить рано (few_sources) */
const MIN_GROUPS = 2;

/** Доля веса «за» среди групп с позицией: от этого порога и выше — источники сходятся (agree) */
const AGREE_SHARE = 0.7;

/** Доля веса «за» не выше этого порога — большинство против (mostly_against); между порогами — split */
const AGAINST_SHARE = 0.3;

/**
 * Официальный первоисточник: одной его группы хватает для вывода (все пересказывают ООН — это не «мало
 * источников», а подтверждение от ООН). По справочнику доменов (этап 04) надёжность ≥ 0.85 у таких типов —
 * только международные организации, статслужбы, центробанки и наука; министерства и администрации
 * (.gov без записи в справочнике — 0.8) и политические сайты сюда не попадают.
 */
const AUTHORITY_TYPES = new Set(["international_org", "government", "academic"]);
const AUTHORITY_RELIABILITY = 0.85;

// ===================== LLM =====================

const STANCES = ["supports", "refutes", "mixed", "neutral"] as const satisfies readonly SourceStance[];

/** Только позиции источников и описание. Вердикта и оценки в схеме нет: статус считает код */
const StancesSchema = z.object({
  // сначала позиция каждого источника, потом описание — так тексты опираются на разбор источников
  sourceAssessments: z.array(
    z.object({ sourceId: z.string(), stance: z.enum(STANCES), relevance: z.number() }),
  ),
  summary: z.string(),
  explanation: z.string(),
});

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_STANCES=real).
 * LLM оценивает позицию каждого источника и описывает, что они говорят. Статус «сторон» считает код:
 *  - нет источников / прогноз → few_sources без вызова LLM;
 *  - голосуют источники с позицией (не neutral) и relevance ≥ MIN_VOTE_RELEVANCE;
 *  - одна группа независимости (voteGroups из дерева, этап 05) — один голос, вес — максимум domainReliability
 *    её источников; без voteGroups каждый источник — своя группа;
 *  - групп с позицией < MIN_GROUPS → few_sources (тексты — texts.ts), иначе по доле веса «за»;
 *  - sourceAssessments — ровно по одной на источник.
 */
export const assessStancesReal: Stage<StancesInput, StancesOutput> = async (input, ctx) => {
  const { claim, sources } = input;
  // о будущем источники ещё ничего не подтверждают — не платим за вызов LLM
  if (claim.category === "prediction") return fixedOutput(input, "prediction", "rules");
  if (!sources.length) return fixedOutput(input, "no_sources", "rules");

  const { data, model } = await askJson(
    {
      effort: "medium",
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      schema: StancesSchema,
    },
    ctx,
  );

  const sourceAssessments = alignAssessments(data.sourceAssessments, sources);
  const votes = countVotes(sourceAssessments, sources, input.voteGroups);
  const status = consensusStatus(votes);
  ctx.log(`08: ${claim.id}: ${status}`, votes);
  if (status === "few_sources") return fixedOutput(input, "few_sources", model, sourceAssessments, votes);

  return {
    claimId: claim.id,
    consensus: {
      status,
      groupsFor: votes.groupsFor,
      groupsAgainst: votes.groupsAgainst,
      groupsMixed: votes.groupsMixed,
      summary: data.summary.trim(),
      explanation: data.explanation.trim(),
      ...(votes.groups < MIN_GROUPS && votes.authority ? { authority: votes.authority.publisher } : {}),
    },
    sourceAssessments,
    model,
    checkedAt: new Date().toISOString(),
  };
};

/** По одной оценке на каждый входной источник; пропущенные LLM — neutral с relevance 0 (не голосуют). */
function alignAssessments(raw: z.infer<typeof StancesSchema>["sourceAssessments"], sources: FoundSource[]) {
  const byId = new Map<string, SourceAssessment>();
  for (const a of raw) {
    if (!byId.has(a.sourceId)) byId.set(a.sourceId, { ...a, relevance: clamp01(a.relevance) });
  }
  return sources.map(
    (s): SourceAssessment => byId.get(s.id) ?? { sourceId: s.id, stance: "neutral", relevance: 0 },
  );
}

interface Votes {
  /** Независимых групп хотя бы с одним голосующим источником */
  groups: number;
  groupsFor: number;
  groupsAgainst: number;
  /** Позиция группы — ноль: «частично» или поровну «за» и «против» */
  groupsMixed: number;
  /** Доля веса «за» среди групп с позицией, 0..1 */
  forShare: number;
  /** Группа одна, и в ней официальный источник с позицией — вывод по нему */
  authority?: { publisher: string; vote: number };
}

function countVotes(
  assessments: SourceAssessment[],
  sources: FoundSource[],
  voteGroups: Record<SourceId, string> | undefined,
): Votes {
  const reliability = new Map(sources.map((s) => [s.id, clamp01(s.domainReliability)]));
  const byId = new Map(sources.map((s) => [s.id, s]));
  const groups = new Map<
    string,
    { sum: number; weight: number; authority?: { publisher: string; vote: number } }
  >();
  for (const a of assessments) {
    if (a.stance === "neutral" || a.relevance < MIN_VOTE_RELEVANCE) continue;
    const key = voteGroups && Object.hasOwn(voteGroups, a.sourceId) ? voteGroups[a.sourceId] : a.sourceId;
    const group = groups.get(key) ?? { sum: 0, weight: 0 };
    group.sum += STANCE_VOTE[a.stance];
    const src = byId.get(a.sourceId);
    if (
      src &&
      a.stance !== "mixed" &&
      AUTHORITY_TYPES.has(src.sourceType) &&
      clamp01(src.domainReliability) >= AUTHORITY_RELIABILITY &&
      !group.authority
    ) {
      group.authority = { publisher: src.publisher, vote: STANCE_VOTE[a.stance] };
    }
    // перепечатки не добавляют веса: группа весит как её самый надёжный источник
    group.weight = Math.max(group.weight, reliability.get(a.sourceId) ?? 0);
    groups.set(key, group);
  }

  // у всех групп надёжность 0 — делить нечего, считаем каждую группу за 1
  const unitWeights = [...groups.values()].every((g) => g.weight === 0);
  const only = groups.size === 1 ? [...groups.values()][0] : undefined;
  const votes: Votes = {
    groups: groups.size,
    groupsFor: 0,
    groupsAgainst: 0,
    groupsMixed: 0,
    forShare: 0,
    authority: only?.authority,
  };
  let forWeight = 0;
  let totalWeight = 0;
  for (const { sum, weight } of groups.values()) {
    const w = unitWeights ? 1 : weight;
    totalWeight += w;
    if (sum > 0) {
      votes.groupsFor++;
      forWeight += w;
    } else if (sum < 0) {
      votes.groupsAgainst++;
    } else {
      votes.groupsMixed++;
      forWeight += w / 2;
    }
  }
  votes.forShare = totalWeight > 0 ? forWeight / totalWeight : 0;
  return votes;
}

function consensusStatus(votes: Votes): ConsensusStatus {
  if (votes.groups < MIN_GROUPS) {
    // одна группа, но её первоисточник официальный — его позиции достаточно
    if (votes.authority?.vote === 1) return "agree";
    if (votes.authority?.vote === -1) return "mostly_against";
    return "few_sources";
  }
  if (votes.forShare >= AGREE_SHARE) return "agree";
  if (votes.forShare <= AGAINST_SHARE) return "mostly_against";
  return "split";
}

function fixedOutput(
  input: StancesInput,
  kind: FixedStances,
  model: string,
  sourceAssessments?: SourceAssessment[],
  votes?: Votes,
): StancesOutput {
  return {
    claimId: input.claim.id,
    consensus: {
      status: "few_sources",
      groupsFor: votes?.groupsFor ?? 0,
      groupsAgainst: votes?.groupsAgainst ?? 0,
      groupsMixed: votes?.groupsMixed ?? 0,
      ...fixedTexts(kind, input.uiLanguage),
    },
    sourceAssessments:
      sourceAssessments ??
      input.sources.map((s) => ({ sourceId: s.id, stance: "neutral" as const, relevance: 0 })),
    model,
    checkedAt: new Date().toISOString(),
  };
}

function clamp01(x: number): number {
  return Number.isNaN(x) ? 0 : Math.min(1, Math.max(0, x));
}
