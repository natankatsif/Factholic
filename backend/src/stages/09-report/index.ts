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
import { textsFor, type ReportTexts } from "./texts.ts";
import type { ProvenanceResult, ReportInput, ReportOutput } from "./types.ts";

export type * from "./types.ts";

/** Источники с relevance ниже — не показываем */
const MIN_RELEVANCE = 0.3;

function formatFullDate(iso: string | null | undefined, t: ReportTexts): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${t.months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
  const t = textsFor(input.uiLanguage ?? "ru");
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
    case "found":
      return { ...base, status: "found" };
    case "pending":
      return base;
    case "failed":
      return { ...base, status: "failed", error: input.error };
    case "checked": {
      const { stances, provenance } = input;
      const flags = buildFlags(provenance?.rootDate, provenance?.mutations, t);
      // этап 04 пишет пробелы поиска только по-русски: на других языках вместо них общая фраза
      const unconfirmed = (input.search?.unconfirmed ?? []).map((gap) =>
        (input.uiLanguage ?? "ru") === "ru" ? gap : t.keyFinding.insufficientDetail,
      );
      const { consensus, consensusSummary } = buildConsensus(
        stances.consensus.status,
        flags,
        unconfirmed,
        t,
        stances.consensus.authority,
      );
      const keyFinding =
        buildKeyFinding(flags, provenance?.rootDate, claim.structure?.time?.relative ?? true, t) ??
        (consensus === "unverifiable" && unconfirmed.length
          ? { title: t.keyFinding.insufficient, subtitle: [...new Set(unconfirmed)].join("; ") }
          : undefined);

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
        sides: {
          for: stances.consensus.groupsFor,
          against: stances.consensus.groupsAgainst,
          mixed: stances.consensus.groupsMixed,
        },
        flags,
        keyFinding,
        provenance: provenance ? toProvenance(provenance, claim, t) : undefined,
        sources,
        checkedAt: stances.checkedAt,
      };
    }
  }
}

function buildFlags(
  rootDate: RootDateOutput | undefined,
  mutations: MutationsOutput | null | undefined,
  t: ReportTexts,
): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  if (rootDate?.flag) {
    flags.push({
      type: "outdated",
      label: t.flags.oldContent,
      detail: t.flags.oldContentDetail(formatShortDate(rootDate.rootPublishedAt)),
      severity: "warning",
    });
  }

  // Флаги — как утверждение изменилось на пути к проверяемому материалу (рёбра в узел "video", включая
  // корень → video). Различия между самими копиями (одна добавила подробность другой) — в дереве, не во флагах.
  const all = (mutations?.mutations ?? []).filter((m) => m.toId === VIDEO_NODE_ID);
  // ссылку на источник убрали — и поэтому подано «как факт»: это одно событие, флаг про ссылку
  const sourceRemovedOn = new Set(
    all
      .filter((m) => m.field === "attribution" && m.direction === "removed")
      .map((m) => `${m.fromId}>${m.toId}`),
  );
  for (const m of all) {
    const flag = mutationFlag(m, sourceRemovedOn.has(`${m.fromId}>${m.toId}`), t);
    if (flag) flags.push(flag);
  }

  // одна и та же мутация встречается на нескольких рёбрах дерева — показываем один раз
  const seen = new Set<string>();
  const unique = flags.filter((f) => {
    const key = `${f.type}|${f.label}|${f.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // в карточке — самые важные: старый контент, раздуто, затем остальное (sort стабильный — порядок дерева сохраняется)
  return unique.sort((a, b) => FLAG_PRIORITY[a.type] - FLAG_PRIORITY[b.type]).slice(0, MAX_FLAGS);
}

const MAX_FLAGS = 5;

/** Серьёзные флаги: старое за новое, цифры в разы, сдвиг места/времени/цифр. Остальные — пояснения */
function isMajorFlag(f: ClaimFlag, t: ReportTexts): boolean {
  return f.type === "outdated" || f.type === "exaggerated" || f.label === t.flags.distortion;
}
const FLAG_PRIORITY: Record<ClaimFlag["type"], number> = {
  outdated: 0,
  exaggerated: 1,
  distortion: 2,
  other: 3,
};

/**
 * Мутация → флаг. «Раздуто» — только выросшие цифры; уверенность и источник — свои флаги:
 * «со ссылкой на источник → как факт» — не преувеличение, а смена подачи.
 */
function mutationFlag(
  m: MutationsOutput["mutations"][number],
  sourceRemovedOnEdge: boolean,
  t: ReportTexts,
): ClaimFlag | null {
  const detail = `${m.before} → ${m.after}`;
  switch (m.field) {
    case "numbers":
      // inflated — выросло в разы (этап 06: ≥ 1,5×)
      if (m.direction === "inflated")
        return { type: "exaggerated", label: t.flags.exaggerated, detail, severity: "danger" };
      // changed — разошлось на 10–50% или записано иначе: источники приводят разные цифры
      if (m.direction === "changed")
        return { type: "distortion", label: t.flags.numbersDiffer, detail, severity: "info" };
      // added — у первоисточника этой цифры нет: могла прийти из другого источника, поэтому мягкий флаг
      if (m.direction === "added")
        return { type: "other", label: t.flags.numberNotFromRoot, detail, severity: "info" };
      if (m.direction === "shifted")
        return { type: "distortion", label: t.flags.distortion, detail, severity: "warning" };
      return null;
    case "place":
    case "time":
      // added — перепечатка добавила место/время, о которых источник молчал: это подробность, а не искажение
      if (m.direction === "shifted" || m.direction === "changed")
        return { type: "distortion", label: t.flags.distortion, detail, severity: "warning" };
      return null;
    case "certainty":
      if (m.direction !== "inflated" || sourceRemovedOnEdge) return null;
      return { type: "distortion", label: t.flags.moreCertain, detail, severity: "warning" };
    case "attribution":
      // сослались на источник — честнее, не флаг
      if (m.direction === "added") return null;
      if (m.direction === "removed")
        return { type: "distortion", label: t.flags.attributionRemoved, detail, severity: "warning" };
      return { type: "distortion", label: t.flags.sourceReplaced, detail, severity: "warning" };
    default:
      return null;
  }
}

function buildKeyFinding(
  flags: ClaimFlag[],
  rootDate: RootDateOutput | undefined,
  /** «вчера» / «сейчас» — подано как недавнее; явная дата («в 2023 году») — указана более поздняя дата */
  relativeTime: boolean,
  t: ReportTexts,
): KeyFinding | undefined {
  if (rootDate?.flag && rootDate.rootPublishedAt && rootDate.claimedAt) {
    const rootMs = Date.parse(rootDate.rootPublishedAt);
    const claimedMs = Date.parse(rootDate.claimedAt);
    const diffDays = Math.round(Math.abs(claimedMs - rootMs) / (1000 * 60 * 60 * 24));
    let timeAgo: string;
    if (diffDays >= 365) {
      timeAgo = t.keyFinding.yearsOld(formatYears(diffDays, t));
    } else if (diffDays >= 30) {
      const months = Math.round(diffDays / 30);
      timeAgo = t.keyFinding.monthsOld(months);
    } else {
      timeAgo = t.keyFinding.daysOld(diffDays);
    }
    return {
      title: timeAgo,
      subtitle: relativeTime ? t.keyFinding.presentedAsRecent : t.keyFinding.laterDateClaimed,
    };
  }
  // заголовок карточки — только серьёзный флаг: «Убрана ссылка на источник» не главный вывод о верном утверждении
  const major = flags.find((f) => isMajorFlag(f, t));
  if (major) {
    return {
      title: major.label,
      subtitle: major.detail,
    };
  }
  return undefined;
}

function buildConsensus(
  status: ConsensusStatus,
  flags: ClaimFlag[],
  /** Жёсткие пробелы поиска: «ни один источник не называет число 200» */
  unconfirmed: string[],
  t: ReportTexts,
  /** Вывод по одному официальному первоисточнику (этап 08): «ООН» */
  authority?: string,
): { consensus: ClaimConsensus; consensusSummary: string } {
  // источники утверждению возражают — это главное, флаги остаются в карточке, но вывод «против»
  if (status === "mostly_against") {
    return {
      consensus: "against",
      consensusSummary: authority ? t.consensus.refutedByRoot(authority) : t.consensus.sourcesObject,
    };
  }
  // итог меняют только серьёзные флаги; мягкие (ссылка на источник, уверенность, расхождение цифр) — только в карточке
  // источники подтверждают утверждение как оно звучит: расхождение с ранней заметкой остаётся флагом на карточке,
  // но итог не меняет (ранняя заметка о первом чтении, утверждение о финальном голосовании)
  const major = flags.filter((f) => isMajorFlag(f, t) && !(status === "agree" && f.type === "distortion"));
  if (major.length > 0) {
    const hasOutdated = flags.some((f) => f.type === "outdated");
    const hasExaggerated = flags.some((f) => f.type === "exaggerated");
    let summary: string;
    if (hasOutdated && hasExaggerated) summary = t.consensus.exaggeratedAndOld;
    else if (hasOutdated) summary = t.consensus.oldContent;
    else if (hasExaggerated) summary = t.consensus.exaggerated;
    else summary = major[0].label.toLowerCase();
    return { consensus: "flagged", consensusSummary: summary };
  }
  // три раунда поиска не нашли, чем подтвердить или опровергнуть — честно говорим, а не угадываем
  if (unconfirmed.length > 0) {
    return { consensus: "unverifiable", consensusSummary: t.consensus.insufficient(unconfirmed[0]!) };
  }

  switch (status) {
    case "agree":
      return {
        consensus: "converge",
        consensusSummary: authority ? t.consensus.confirmedByRoot(authority) : t.consensus.positionsAgree,
      };
    case "split":
      return { consensus: "split", consensusSummary: t.consensus.split };
    case "few_sources":
    default:
      return { consensus: "unverifiable", consensusSummary: t.consensus.fewSources };
  }
}

/** «3,5» / «3.5» — лет между датами, для подписей */
function formatYears(diffDays: number, t: ReportTexts): string {
  return (diffDays / 365).toFixed(1).replace(".0", "").replace(".", t.decimalSeparator);
}

function toProvenance({ tree, mutations }: ProvenanceResult, claim: Claim, t: ReportTexts): ProvenanceTree {
  const mutationList = mutations?.mutations ?? [];
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  // Текст узла: у публикаций — заголовок, у самого материала — цитата ЭТОГО тезиса. Заголовок материала
  // общий для всех тезисов (у вставленного текста — его первое предложение), в «Стало» он путает тезисы.
  const textOf = (n: { id: string; title: string } | undefined): string =>
    !n ? "" : n.id === VIDEO_NODE_ID ? claim.quote : n.title;

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
    let categoryLabel = t.node.media;
    const pubLower = n.publisher.toLowerCase();
    if (
      pubLower.includes("мэрия") ||
      pubLower.includes("министерство") ||
      pubLower.includes("правительство") ||
      n.domain.endsWith(".gov.md")
    ) {
      category = "official";
      categoryLabel = t.node.official;
    } else if (n.domain.includes("t.me") || pubLower.includes("канал") || pubLower.includes("паблик")) {
      category = "channel";
      categoryLabel = t.node.channel;
    }

    // разбор показываем как разбор: он не пересказывает историю, а проверяет её
    if (n.relation === "debunks") {
      category = "fact_checker";
      categoryLabel = t.node.debunk;
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
          label: t.node.watchFragment,
          timecodeSec: Math.floor(claim.range.start),
        }
      : {
          type: "open_source",
          label: t.node.openSource,
          url: n.url,
        };

    // более ранняя публикация могла не найтись: обещать «первая» нельзя
    if (isPrimary) categoryLabel = t.node.earliest;

    const shortCode = n.publisher.slice(0, 2).toUpperCase();

    return {
      id: n.id,
      name: n.publisher || n.title,
      shortCode,
      category,
      categoryLabel,
      role,
      isPrimary,
      date: formatFullDate(n.publishedAt, t),
      isoDate: n.publishedAt,
      quote: textOf(n),
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
            ? t.change.numbers
            : m.field === "place"
              ? t.change.place
              : m.field === "time"
                ? t.change.time
                : m.field === "certainty"
                  ? t.change.certainty
                  : t.change.attribution,
        description: m.note || `${m.before} → ${m.after}`,
      }));

      const diff: ProvenanceEdgeDiff | undefined = hasDistortion
        ? {
            before: {
              sourceName: parentNode?.publisher || t.node.source,
              date: formatShortDate(parentNode?.publishedAt),
              text: textOf(parentNode),
            },
            after: {
              sourceName: node.publisher || t.node.source,
              date: formatShortDate(node.publishedAt),
              text: textOf(node),
            },
            changes,
          }
        : undefined;

      const label = hasDistortion ? t.edge.changed : node.via === "link" ? t.edge.unchanged : t.edge.probable;

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
  // Не найденный источник, на который указывают копии: узел без ссылки, чтобы не выдавать ближайшую копию за начало
  for (const hidden of tree.hiddenSources ?? []) {
    nodes.push({
      id: hidden.id,
      name: hidden.name,
      category: "other",
      categoryLabel: t.node.sourceNotFound,
      role: "retelling",
      date: t.node.dateUnknown,
      quote: t.node.citedBy(hidden.copyIds.length),
    });
    for (const copyId of hidden.copyIds) {
      edges.push({
        id: `edge_${hidden.id}_${copyId}`,
        fromNodeId: hidden.id,
        toNodeId: copyId,
        relationType: "likely_derived",
        label: t.edge.cites,
      });
    }
  }

  // Путь — связи от материала вверх. Первоисточник (самая ранняя публикация с утверждением) не связан с
  // этой цепочкой — всё равно ставим первым: он отвечает «когда появилось впервые», но следующий шаг
  // помечаем linked: false, и UI рисует разрыв, а не стрелку «взял у».
  if (tree.rootId && !pathChain.some((n) => n.id === tree.rootId)) {
    const rootNode = byId.get(tree.rootId);
    if (rootNode) pathChain.unshift(rootNode);
  }
  if (!pathChain.length) pathChain.push(...tree.nodes.slice(0, 4));

  const pathSummary: ProvenancePathStep[] = pathChain.map((n, i) => {
    const isRoot = n.id === tree.rootId;
    const prev = pathChain[i - 1];
    const linked = !prev || n.parentId === prev.id;
    // начало цепочки после разрыва (или без первоисточника): раньше нашлись публикации, связь с ними не установлена
    const isChainHead = !isRoot && n.id !== VIDEO_NODE_ID && pathChain.length > 1 && (i === 0 || !linked);
    const nodeMutations = mutationList.filter((m) => m.toId === n.id);
    const isDistortion = nodeMutations.length > 0;
    const tag = isRoot
      ? t.path.original
      : isChainHead && !isDistortion
        ? t.path.chainStart
        : isDistortion
          ? nodeMutations[0].note || `${nodeMutations[0].before} → ${nodeMutations[0].after}`
          : t.path.retelling;
    return {
      name: n.publisher || n.title,
      date: formatShortDate(n.publishedAt),
      tag,
      isDistortion,
      ...(linked ? {} : { linked: false }),
    };
  });

  const timelineDates = [
    ...new Set(tree.nodes.map((n) => formatFullDate(n.publishedAt, t)).filter((d) => d !== "—")),
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
          timelineGaps.push({
            afterNodeId: a.id,
            beforeNodeId: b.id,
            label: t.silenceYears(formatYears(diffDays, t)),
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
