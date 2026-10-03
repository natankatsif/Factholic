import type {
  ClaimConsensus,
  ClaimFlag,
  FactCheck,
  KeyFinding,
  MutationChange,
  ProvenanceEdge,
  ProvenanceEdgeDiff,
  ProvenanceNode,
  ProvenanceNodeAction,
  ProvenanceNodeRole,
  ProvenancePathStep,
  ProvenanceRelationType,
  ProvenanceSourceCategory,
  ProvenanceTree,
  SourceCard,
  TimelineGap,
} from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { FoundSource } from "../04-source-search/types.ts";
import { VIDEO_NODE_ID } from "../05-provenance/types.ts";
import type { MutationsOutput } from "../06-mutations/types.ts";
import type { RootDateOutput } from "../07-root-date/types.ts";
import type { ConsensusStatus, SourceAssessment } from "../08-stances/types.ts";
import type { ProvenanceResult, ReportInput, ReportOutput } from "./types.ts";

export type * from "./types.ts";

/** Источники с relevance ниже — не показываем */
const MIN_RELEVANCE = 0.3;

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function formatFullDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getUTCFullYear()}`;
}

/** Чистая функция: внутренние типы пайплайна → модель для фронта. */
export function toFactCheck(input: ReportInput): ReportOutput {
  const { claim } = input;
  const base: FactCheck = {
    id: claim.id,
    status: "checking",
    range: claim.range,
    quote: claim.quote,
    claim: claim.normalized,
    category: claim.category,
    speaker: claim.speaker,
    consensus: "unverifiable",
    flags: [],
    verdict: null,
    sources: [],
  };

  switch (input.kind) {
    case "pending":
      return base;
    case "failed":
      return { ...base, status: "failed", error: input.error };
    case "checked": {
      const { stances, provenance } = input;
      const flags = buildFlags(provenance?.rootDate, provenance?.mutations);
      const { consensus, consensusSummary } = buildConsensus(stances.consensus.status, flags);
      const keyFinding = buildKeyFinding(flags, provenance?.rootDate);

      const byId = new Map(stances.sourceAssessments.map((a) => [a.sourceId, a]));
      const sources = input.sources
        .filter((s) => (byId.get(s.id)?.relevance ?? 0) >= MIN_RELEVANCE)
        .sort((a, b) => byId.get(b.id)!.relevance - byId.get(a.id)!.relevance)
        .map((s) => toSourceCard(s, byId.get(s.id)!));

      return {
        ...base,
        status: "done",
        consensus,
        consensusSummary,
        flags,
        keyFinding,
        provenance: provenance ? toProvenance(provenance, claim) : undefined,
        sources,
        checkedAt: stances.checkedAt,
      };
    }
  }
}

function buildFlags(
  rootDate: RootDateOutput | undefined,
  mutations: MutationsOutput | null | undefined,
): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  if (rootDate?.flag) {
    flags.push({
      type: "outdated",
      label: "Старый контент",
      detail: `первоисточник от ${formatShortDate(rootDate.rootPublishedAt)}`,
      severity: "warning",
    });
  }
  for (const m of mutations?.mutations ?? []) {
    if (m.direction === "inflated") {
      flags.push({
        type: "exaggerated",
        label: "Раздуто",
        detail: `${m.before} → ${m.after}`,
        severity: "danger",
      });
    } else if (m.direction === "shifted" || m.direction === "changed" || m.direction === "added") {
      // «added» — перепечатка добавила то, чего не было у источника (например, цифры пострадавших)
      flags.push({
        type: "distortion",
        label: "Искажение",
        detail: `${m.before} → ${m.after}`,
        severity: "warning",
      });
    }
  }
  return flags;
}

function buildKeyFinding(flags: ClaimFlag[], rootDate: RootDateOutput | undefined): KeyFinding | undefined {
  if (rootDate?.flag && rootDate.rootPublishedAt && rootDate.claimedAt) {
    const rootMs = Date.parse(rootDate.rootPublishedAt);
    const claimedMs = Date.parse(rootDate.claimedAt);
    const diffDays = Math.round(Math.abs(claimedMs - rootMs) / (1000 * 60 * 60 * 24));
    let timeAgo: string;
    if (diffDays >= 365) {
      const years = (diffDays / 365).toFixed(1).replace(".0", "").replace(".", ",");
      timeAgo = `Событию ${years} года`;
    } else if (diffDays >= 30) {
      const months = Math.round(diffDays / 30);
      timeAgo = `Событию ${months} месяцев`;
    } else {
      timeAgo = `Событию ${diffDays} дней`;
    }
    return {
      title: timeAgo,
      subtitle: "в видео подано как недавнее",
    };
  }
  if (flags.length > 0) {
    return {
      title: flags[0].label,
      subtitle: flags[0].detail,
    };
  }
  return undefined;
}

function buildConsensus(
  status: ConsensusStatus,
  flags: ClaimFlag[],
): { consensus: ClaimConsensus; consensusSummary: string } {
  if (flags.length > 0) {
    const hasOutdated = flags.some((f) => f.type === "outdated");
    const hasExaggerated = flags.some((f) => f.type === "exaggerated");
    let summary: string;
    if (hasOutdated && hasExaggerated) summary = "раздуто • старое";
    else if (hasOutdated) summary = "старый контент";
    else if (hasExaggerated) summary = "раздуто";
    else summary = flags[0].label.toLowerCase();
    return { consensus: "flagged", consensusSummary: summary };
  }

  switch (status) {
    case "agree":
      return { consensus: "converge", consensusSummary: "позиции совпадают" };
    case "split":
      return { consensus: "split", consensusSummary: "мнения расходятся" };
    case "mostly_against":
      return { consensus: "against", consensusSummary: "источники возражают" };
    case "few_sources":
    default:
      return { consensus: "unverifiable", consensusSummary: "мало источников" };
  }
}

function toProvenance({ tree, mutations }: ProvenanceResult, claim: Claim): ProvenanceTree {
  const mutationList = mutations?.mutations ?? [];
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));

  const nodes: ProvenanceNode[] = tree.nodes.map((n, idx) => {
    const isPrimary = n.id === tree.rootId;
    const isTarget = n.id === VIDEO_NODE_ID;
    const nodeMutations = mutationList.filter((m) => m.toId === n.id);
    const hasDistortion = nodeMutations.length > 0;

    let role: ProvenanceNodeRole = "retelling";
    if (isPrimary) role = "primary";
    else if (isTarget) role = "target";
    else if (hasDistortion) role = "distortion";

    let category: ProvenanceSourceCategory = "media";
    let categoryLabel = "СМИ";
    const pubLower = n.publisher.toLowerCase();
    if (
      pubLower.includes("мэрия") ||
      pubLower.includes("министерство") ||
      pubLower.includes("правительство") ||
      n.domain.endsWith(".gov.md")
    ) {
      category = "official";
      categoryLabel = "официальный";
    } else if (n.domain.includes("t.me") || pubLower.includes("канал") || pubLower.includes("паблик")) {
      category = "channel";
      categoryLabel = "паблик";
    }

    const tags: string[] = [];
    for (const m of nodeMutations) {
      if (m.field === "numbers") tags.push(`${m.before} → ${m.after}`);
      else if (m.field === "place") tags.push(`${m.before} → ${m.after}`);
      else if (m.field === "time") tags.push(m.after);
      else if (m.note) tags.push(m.note);
    }

    const action: ProvenanceNodeAction = isTarget
      ? {
          type: "watch_fragment",
          label: "Смотреть фрагмент ↗",
          timecodeSec: Math.floor(claim.range.start),
        }
      : {
          type: "open_source",
          label: "Открыть источник ↗",
          url: n.url,
        };

    const shortCode = n.publisher.slice(0, 2).toUpperCase();

    return {
      id: n.id,
      name: n.publisher || n.title,
      shortCode,
      category,
      categoryLabel,
      role,
      isPrimary,
      date: formatFullDate(n.publishedAt),
      isoDate: n.publishedAt,
      quote: n.title,
      url: n.url,
      tags: tags.length ? tags : undefined,
      action,
      column: idx,
      row: 0,
    };
  });

  const edges: ProvenanceEdge[] = [];
  for (const node of tree.nodes) {
    if (node.parentId !== null) {
      const parentNode = byId.get(node.parentId);
      const edgeMutations = mutationList.filter((m) => m.fromId === node.parentId && m.toId === node.id);
      const hasDistortion = edgeMutations.length > 0;
      const relationType: ProvenanceRelationType = hasDistortion
        ? "distorted"
        : node.via === "link"
          ? "direct"
          : "likely_derived";

      const changes: MutationChange[] = edgeMutations.map((m) => ({
        category: m.field === "place" ? "location" : m.field,
        categoryLabel:
          m.field === "numbers"
            ? "Цифры"
            : m.field === "place"
              ? "Место"
              : m.field === "time"
                ? "Время"
                : m.field === "certainty"
                  ? "Уверенность"
                  : "Источник",
        description: m.note || `${m.before} → ${m.after}`,
      }));

      const diff: ProvenanceEdgeDiff | undefined = hasDistortion
        ? {
            before: {
              sourceName: parentNode?.publisher || "Источник",
              date: formatShortDate(parentNode?.publishedAt),
              text: parentNode?.title || "",
            },
            after: {
              sourceName: node.publisher || "Источник",
              date: formatShortDate(node.publishedAt),
              text: node.title || "",
            },
            changes,
          }
        : undefined;

      const label = hasDistortion
        ? "пересказ с изменениями"
        : node.via === "link"
          ? "пересказ без изменений"
          : "вероятно взят отсюда";

      edges.push({
        id: `edge_${node.parentId}_${node.id}`,
        fromNodeId: node.parentId,
        toNodeId: node.id,
        relationType,
        label,
        hasDistortion,
        diff,
      });
    }
  }

  const pathChain: typeof tree.nodes = [];
  let curr = byId.get(VIDEO_NODE_ID);
  while (curr) {
    pathChain.unshift(curr);
    curr = curr.parentId !== null ? byId.get(curr.parentId) : undefined;
  }
  if (tree.rootId && !pathChain.some((n) => n.id === tree.rootId)) {
    const rootNode = byId.get(tree.rootId);
    if (rootNode) pathChain.unshift(rootNode);
  }
  if (!pathChain.length) pathChain.push(...tree.nodes.slice(0, 4));

  const pathSummary: ProvenancePathStep[] = pathChain.map((n) => {
    const isRoot = n.id === tree.rootId;
    const nodeMutations = mutationList.filter((m) => m.toId === n.id);
    const isDistortion = nodeMutations.length > 0;
    const tag = isRoot
      ? "оригинал"
      : isDistortion
        ? nodeMutations[0].note || `${nodeMutations[0].before} → ${nodeMutations[0].after}`
        : "пересказ";
    return {
      name: n.publisher || n.title,
      date: formatShortDate(n.publishedAt),
      tag,
      isDistortion,
    };
  });

  const timelineDates = [
    ...new Set(tree.nodes.map((n) => formatFullDate(n.publishedAt)).filter((d) => d !== "—")),
  ];

  const timelineGaps: TimelineGap[] = [];
  for (let i = 0; i < tree.nodes.length - 1; i++) {
    const a = tree.nodes[i];
    const b = tree.nodes[i + 1];
    if (a.publishedAt && b.publishedAt) {
      const msA = Date.parse(a.publishedAt);
      const msB = Date.parse(b.publishedAt);
      if (!isNaN(msA) && !isNaN(msB)) {
        const diffDays = Math.round(Math.abs(msB - msA) / (1000 * 60 * 60 * 24));
        if (diffDays >= 180) {
          const years = (diffDays / 365).toFixed(1).replace(".0", "").replace(".", ",");
          timelineGaps.push({
            afterNodeId: a.id,
            beforeNodeId: b.id,
            label: `${years} года тишины`,
          });
        }
      }
    }
  }

  const selectedEdgeId = edges.find((e) => e.hasDistortion)?.id ?? edges[0]?.id;

  return {
    pathSummary,
    nodes,
    edges,
    timelineDates,
    timelineGaps: timelineGaps.length ? timelineGaps : undefined,
    primarySourceCount: tree.rootId ? 1 : 0,
    totalSourcesCount: tree.nodes.length,
    selectedEdgeId,
  };
}

function toSourceCard(s: FoundSource, a: SourceAssessment): SourceCard {
  return {
    id: s.id,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    domain: s.domain,
    faviconUrl: `https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`,
    sourceType: s.sourceType,
    publishedAt: s.publishedAt,
    language: s.language,
    country: s.country,
    snippet: s.snippet,
    stance: a.stance,
  };
}
