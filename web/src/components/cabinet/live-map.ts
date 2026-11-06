/** Данные бэкенда → данные экранов. Подписи берутся из словаря, цвета кружков считаются из названия */
import {
  formatTimecode,
  type FactCheck,
  type ProvenanceEdge,
  type ProvenanceNode,
  type SourceStance,
} from "@news/contracts";
import type {
  Alert,
  OrgCheckDetail,
  OrgNarrativeDetail,
  OrgSession,
  OrgVideo,
  TrackedClaim,
} from "../../../../backend/src/org/types";
import type { WatchWithClaim } from "./api";
import { LOCALE_TAGS } from "../../i18n/locale";
import type { CabinetDictionary } from "./dictionary";
import type {
  AlertItem,
  CabinetSession,
  CheckView,
  ChangeKind,
  EdgeKind,
  FeedItem,
  HomeView,
  NarrativeView,
  OutletType,
  PublicationNode,
  QuestionRow,
  Stance,
  TreeEdge,
  TreeNode,
  VideoRow,
  WatchRow,
} from "./types";

const PALETTE = ["#1660D6", "#0A93AD", "#D42A7E", "#4A3333", "#6E1EF0", "#1DA57A", "#FF7A12"];
const DAY_MS = 86_400_000;

function colorOf(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function ageInDays(iso: string, now = new Date()): number {
  return Math.round((dayStart(now) - dayStart(new Date(iso))) / DAY_MS);
}

const time = (iso: string, t: CabinetDictionary) =>
  new Date(iso).toLocaleTimeString(LOCALE_TAGS[t.locale], { hour: "2-digit", minute: "2-digit" });
const dayMonth = (iso: string, t: CabinetDictionary) =>
  new Date(iso).toLocaleDateString(LOCALE_TAGS[t.locale], { day: "numeric", month: "long" });

export function whenLabel(iso: string, t: CabinetDictionary): string {
  const age = ageInDays(iso);
  if (age === 0) return `${t.dates.today}, ${time(iso, t)}`;
  if (age === 1) return `${t.dates.yesterday}, ${time(iso, t)}`;
  return `${dayMonth(iso, t)}, ${time(iso, t)}`;
}

function dayLabel(iso: string, t: CabinetDictionary): string {
  const age = ageInDays(iso);
  return age === 0 ? t.dates.today : age === 1 ? t.dates.yesterday : dayMonth(iso, t);
}

const STANCES: Record<SourceStance, Stance> = {
  supports: "for",
  refutes: "against",
  mixed: "partial",
  neutral: "neutral",
};

function outletType(node: ProvenanceNode): OutletType {
  if (node.category === "fact_checker" || node.categoryLabel === "разбор") return "debunk";
  if (node.category === "official") return "official";
  if (node.category === "channel" || node.category === "social") return "channel";
  return "media";
}

const CHANGE_KINDS: Record<string, ChangeKind> = { numbers: "number", location: "place", time: "time" };

function edgeKind(edge: ProvenanceEdge, to?: ProvenanceNode): EdgeKind {
  // к проверяемому тексту подключается самая похожая публикация: это сходство, а не доказанное заимствование
  if (to?.role === "target") return "probable";
  if (to && outletType(to) === "debunk") return "debunk";
  if (edge.relationType === "distorted" || edge.hasDistortion) return "changed";
  return edge.relationType === "likely_derived" ? "probable" : "confirmed";
}

function publication(
  node: ProvenanceNode,
  factCheck: FactCheck,
  parent?: ProvenanceEdge,
  parentName?: string,
): PublicationNode {
  const source = factCheck.sources.find((item) => item.url === node.url);
  const type = outletType(node);
  const change = parent?.diff?.changes[0];
  return {
    id: node.id,
    kind: "publication",
    role: node.isPrimary ? "root" : type === "debunk" ? "debunk" : undefined,
    outlet: node.name,
    color: colorOf(node.name),
    type,
    language: source?.language ?? "",
    date: node.date || undefined,
    quote: node.quote,
    changeLabel: node.tags?.[0],
    stance: source ? STANCES[source.stance] : undefined,
    detail: {
      headline: source?.title ?? node.quote,
      fullQuote: node.quote,
      parentName: parentName ?? "",
      change: change
        ? {
            kind: CHANGE_KINDS[change.category] ?? "number",
            text: `${change.categoryLabel}: ${change.description}`,
          }
        : undefined,
      parentLink: parent?.label ?? "",
      url: node.url ?? "",
    },
  };
}

function treeOf(
  factCheck: FactCheck,
  t: CabinetDictionary,
): Pick<CheckView, "nodes" | "edges" | "unlinked" | "rootUnknown"> {
  const tree = factCheck.provenance;
  if (!tree)
    return { nodes: [{ id: "checked", kind: "checked", quote: factCheck.quote }], edges: [], unlinked: [] };
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  const linked = new Set(tree.edges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]));
  const nodes: TreeNode[] = [];
  const unlinked: CheckView["unlinked"] = [];
  for (const node of tree.nodes) {
    if (node.role === "target") nodes.push({ id: node.id, kind: "checked", quote: factCheck.quote });
    else if (!node.url) nodes.push({ id: node.id, kind: "missing", name: node.name, note: node.quote });
    else if (!linked.has(node.id) && !node.isPrimary) {
      unlinked.push({
        id: node.id,
        outlet: node.name,
        color: colorOf(node.name),
        date: node.date,
        url: node.url,
      });
    } else {
      const parent = tree.edges.find((edge) => edge.toNodeId === node.id);
      nodes.push(publication(node, factCheck, parent, parent && byId.get(parent.fromNodeId)?.name));
    }
  }
  const endOf = (node?: ProvenanceNode) => ({
    name: node?.role === "target" ? t.node.checkedText : (node?.name ?? ""),
    date: node?.role === "target" ? "" : node?.date,
    quote: node?.role === "target" ? factCheck.quote : (node?.quote ?? ""),
  });
  // карточка есть у каждой связи: готовое сравнение бывает не всегда, тогда показываем обе цитаты
  const edges: TreeEdge[] = tree.edges.map((edge) => {
    const from = byId.get(edge.fromNodeId);
    const to = byId.get(edge.toNodeId);
    // подпись и дата проверяемого текста берутся не из сравнения: там «Это видео» и дата материала
    const side = (node: ProvenanceNode | undefined, diff?: NonNullable<ProvenanceEdge["diff"]>["before"]) => {
      const end = endOf(node);
      if (!diff) return { sourceName: end.name, date: end.date, text: end.quote };
      return node?.role === "target" ? { ...diff, sourceName: end.name, date: "" } : diff;
    };
    const before = side(from, edge.diff?.before);
    const after = side(to, edge.diff?.after);
    const changes =
      edge.diff?.changes.map((change) => ({
        kind: CHANGE_KINDS[change.category] ?? ("number" as const),
        text: `${change.categoryLabel}: ${change.description}`,
      })) ?? (to?.tags ?? []).map((tag) => ({ kind: "number" as const, text: tag }));
    return {
      id: edge.id,
      from: edge.fromNodeId,
      to: edge.toNodeId,
      kind: edgeKind(edge, to),
      detail: {
        beforeSource: [before.sourceName, before.date].filter(Boolean).join(", "),
        afterSource: [after.sourceName, after.date].filter(Boolean).join(", "),
        before: [[{ text: before.text }]],
        after: [[{ text: after.text }]],
        changes,
        evidence: to?.role === "target" ? t.edgeCard.similarOnly : edge.label,
        fragmentUrl: to?.role === "target" ? (from?.url ?? "") : (to?.url ?? from?.url ?? ""),
        similarOnly: to?.role === "target",
      },
    };
  });
  const hasPublications = tree.nodes.some((node) => node.role !== "target" && node.url);
  return {
    nodes,
    edges,
    unlinked,
    // без публикаций говорить о самой ранней не о чем
    rootUnknown: hasPublications && !tree.nodes.some((node) => node.isPrimary),
  };
}

export function alertItem(alert: Alert, t: CabinetDictionary): AlertItem {
  return {
    id: alert.id,
    checkId: alert.checkId,
    claimId: alert.claimId,
    claim: alert.claimText,
    title: t.alerts.titles[alert.type],
    text: t.alerts.text(alert.type, alert.params),
    time: whenLabel(alert.createdAt, t),
    unread: !alert.readAt,
  };
}

function alertFeed(alerts: Alert[], t: CabinetDictionary): FeedItem[] {
  return alerts.map((alert, index) => {
    const item = alertItem(alert, t);
    const notable = index === 0 && !alert.readAt;
    const target = { alertId: alert.id, nodeIds: alert.nodeIds, publications: alert.params.publications };
    return notable
      ? { type: "alert", title: item.title.toLowerCase(), time: item.time, text: item.text, ...target }
      : { type: "debunk", title: item.title, time: item.time, text: item.text, ...target };
  });
}

function buildFeed(
  detail: OrgCheckDetail,
  factCheck: FactCheck | undefined,
  t: CabinetDictionary,
): FeedItem[] {
  const { check, report, watches } = detail;
  const claims = report?.factChecks ?? [];
  const startedTime = time(check.startedAt, t);
  if (check.status === "failed") {
    return [
      { type: "failed" },
      { type: "saved", time: time(check.finishedAt ?? check.startedAt, t), count: 0 },
    ];
  }
  const found: FeedItem = {
    type: "claims",
    time: startedTime,
    count: claims.length || 1,
    options: claims.length > 1 ? claims.map((item) => item.claim) : undefined,
  };
  if (check.status === "running")
    return claims.length ? [found, { type: "searching" }] : [{ type: "searching" }];
  if (!factCheck) return [found];

  const finished = time(check.finishedAt ?? check.startedAt, t);
  const tree = factCheck.provenance;
  const publications = (tree?.nodes ?? []).filter((node) => node.role !== "target" && node.url);
  const root = tree?.nodes.find((node) => node.isPrimary);
  const sides = {
    for: factCheck.sides?.for ?? 0,
    against: factCheck.sides?.against ?? 0,
    partial: factCheck.sides?.mixed ?? 0,
    neutral: 0,
  };
  const watch = watches[0];
  const items: FeedItem[] = [...alertFeed(detail.alerts, t)];
  if (watch) {
    items.push({
      type: "watch-on",
      time: dayLabel(watch.createdAt, t),
      text: t.alerts.watchSummary(
        watch.frequency,
        watch.signals.length,
        watch.until && dayMonth(watch.until, t),
      ),
    });
  }
  const few = factCheck.consensus === "unverifiable" || !root;
  if (few) {
    if (publications.length === 0) {
      items.push({ type: "no-publications", time: finished });
    } else {
      items.push({ type: "few-sources", time: finished, count: publications.length });
      if (!root) items.push({ type: "root-unknown-plain", time: finished });
    }
  } else {
    items.push(found, {
      type: "result",
      time: finished,
      sides,
      earliest: { outlet: root.name, date: root.date },
      note: factCheck.keyFinding?.title,
      summary: factCheck.consensusSummary,
    });
  }
  if (!watch) items.push({ type: "offer", variant: few ? "few" : "default" });
  return items;
}

export function toCheckView(detail: OrgCheckDetail, claimIndex: number, t: CabinetDictionary): CheckView {
  const { check, report, claims } = detail;
  const done = (report?.factChecks ?? []).filter((item) => item.status === "done");
  const factCheck = done[claimIndex] ?? done[0];
  const claim = claims.find((item) => item.factCheckId === factCheck?.id) ?? claims[0];
  const tree = factCheck ? treeOf(factCheck, t) : undefined;
  const publications = tree
    ? tree.nodes.filter((node) => node.kind === "publication").length + tree.unlinked.length
    : 0;
  const watch = detail.watches.find((item) => item.claimId === claim?.id);
  const reportFound = check.steps.find((step) => step.key === "search")?.found ?? 0;
  const quote = factCheck?.quote ?? report?.factChecks[0]?.quote ?? check.input;
  const target = factCheck ?? report?.factChecks.find((item) => item.status === "failed");
  return {
    id: check.id,
    status: check.status,
    claimId: claim?.id,
    claimStatus: claim?.status,
    claim: factCheck ? `«${factCheck.claim}»` : `«${check.input.slice(0, 120)}»`,
    timeLabel:
      check.status === "running"
        ? t.panel.startedAt(time(check.startedAt, t))
        : check.status === "failed"
          ? time(check.finishedAt ?? check.startedAt, t)
          : whenLabel(check.finishedAt ?? check.startedAt, t),
    watchFrequency: watch?.frequency,
    nodes: tree?.nodes ?? [{ id: "checked", kind: "checked", quote }],
    edges: tree?.edges ?? [],
    unlinked: tree?.unlinked ?? [],
    rootUnknown: tree?.rootUnknown,
    placeholders: check.status === "running" ? 1 : 0,
    steps: check.steps,
    stats:
      check.status === "done"
        ? {
            publications,
            links: tree?.edges.length,
            changes: tree?.edges.filter((edge) => edge.kind === "changed").length,
          }
        : { publications: reportFound },
    feed: buildFeed(detail, factCheck, t),
    factCheckId: target?.id,
    searchingMore: target ? detail.searchingMore.includes(target.id) : false,
    moreFound: check.lastMore?.found,
  };
}

/** Дерево одного утверждения вне проверки кабинета: сайт и видео. Ленты и статуса проверки у него нет */
export function toClaimCanvas(factCheck: FactCheck, t: CabinetDictionary): CheckView {
  const tree = treeOf(factCheck, t);
  return {
    id: factCheck.id,
    status: "done",
    claim: factCheck.claim,
    ...tree,
    placeholders: 0,
    stats: {
      publications: tree.nodes.filter((node) => node.kind === "publication").length + tree.unlinked.length,
      links: tree.edges.length,
      changes: tree.edges.filter((edge) => edge.kind === "changed").length,
    },
    feed: [],
  };
}

export function toQuestionRow(
  claim: TrackedClaim,
  session: OrgSession,
  watched: Set<string>,
  t: CabinetDictionary,
): QuestionRow {
  const narrative = session.narratives.find((item) => item.id === claim.narrativeId);
  return {
    id: claim.id,
    checkId: claim.latestCheckId,
    text: `«${claim.text}»`,
    author: claim.createdByName,
    date: dayMonth(claim.createdAt, t),
    language: claim.language,
    narrative: narrative?.title,
    checks: claim.checksCount,
    last: whenLabel(claim.lastCheckAt, t),
    ageDays: ageInDays(claim.lastCheckAt),
    status: claim.status,
    searching: claim.searching,
    scopes: [
      "all",
      "mine",
      ...(watched.has(claim.id) ? (["watched"] as const) : []),
      ...(claim.narrativeId ? [] : (["ungrouped"] as const)),
    ],
  };
}

/** Идущая проверка: вопроса ещё нет, поэтому строка собирается из текста и шага */
export function toRunningRow(
  run: OrgSession["running"][number],
  session: OrgSession,
  t: CabinetDictionary,
): QuestionRow {
  return {
    id: run.id,
    checkId: run.id,
    text: `«${run.claim}»`,
    author: session.member.name,
    date: t.dates.today,
    language: "",
    checks: 1,
    last: t.topBar.step(run.step, run.totalSteps),
    ageDays: 0,
    status: "new",
    scopes: ["running"],
    runningStep: t.search.steps[run.stepKey],
  };
}

export function toWatchRow(watch: WatchWithClaim, t: CabinetDictionary): WatchRow {
  return {
    id: watch.id,
    claimId: watch.claim.id,
    checkId: watch.claim.latestCheckId,
    text: `«${watch.claim.text}»`,
    claimStatus: watch.claim.status,
    fresh: watch.fresh,
    last: whenLabel(watch.lastCheckAt ?? watch.claim.lastCheckAt, t),
    status: watch.status,
  };
}

export function toSession(session: OrgSession, alerts: Alert[], t: CabinetDictionary): CabinetSession {
  const start = new Date(session.limits.periodStart);
  return {
    organization: session.organization.name,
    memberName: session.member.name,
    memberRole: t.roles[session.member.role],
    memberInitial: session.member.name.charAt(0),
    unreadAlerts: session.unreadAlerts,
    alerts: alerts.map((alert) => alertItem(alert, t)),
    clarifications: session.clarifications.map(({ id, question, input, rewritten }) => ({
      id,
      question,
      input,
      rewritten,
    })),
    running: session.running.map((item) => ({
      id: item.id,
      claim: item.claim,
      step: item.step,
      totalSteps: item.totalSteps,
      message: t.search.steps[item.stepKey].toLowerCase(),
      video: item.kind === "video",
      found: item.found,
    })),
    counts: session.counts,
    narratives: session.narratives,
    suggestions: session.suggestions.map((item) => ({
      id: item.id,
      claims: item.claims,
      quotes: item.quotes.map((quote) => ({
        outlet: quote.site,
        date: quote.date,
        text: quote.text,
        url: quote.url,
      })),
    })),
    limits: {
      month: t.dates.months[start.getMonth()]!,
      resetDate: dayMonth(session.limits.resetAt, t),
      checksUsed: session.limits.checksUsed,
      checksTotal: session.limits.checksTotal,
      watchesUsed: session.limits.watchesUsed,
      watchesTotal: session.limits.watchesTotal,
    },
  };
}

export function toHomeView(
  session: OrgSession,
  claims: TrackedClaim[],
  t: CabinetDictionary,
  noClaimsInput?: string,
): HomeView {
  const limit = session.limits.checksUsed >= session.limits.checksTotal;
  return {
    state: limit ? "limit" : noClaimsInput ? "no-claims" : "empty",
    input: noClaimsInput,
    suggestions: [],
    recent: claims
      .slice(0, 3)
      .map((claim) => ({ id: claim.id, text: claim.text, date: dayLabel(claim.lastCheckAt, t) })),
  };
}

export function toNarrativeView(detail: OrgNarrativeDetail, t: CabinetDictionary): NarrativeView {
  const { narrative, claims } = detail;
  return {
    id: narrative.id,
    title: narrative.title,
    status: claims.some((claim) => claim.status === "spreading")
      ? "spreading"
      : (claims[0]?.status ?? "stable"),
    description: narrative.description,
    confirmedBy: narrative.confirmedBy,
    confirmedAt: dayMonth(narrative.confirmedAt, t),
    publications: detail.publications,
    languages: detail.languages,
    lastChange: detail.lastChange ? dayMonth(detail.lastChange, t) : "",
    questions: claims.map((claim) => ({
      id: claim.id,
      checkId: claim.latestCheckId,
      text: `«${claim.text}»`,
      status: claim.status,
      sides: claim.sides ?? { for: 0, against: 0, partial: 0, neutral: 0 },
      searching: claim.searching,
    })),
    quotes: narrative.quotes.map((quote, index) => ({
      id: String(index),
      outlet: quote.site,
      color: colorOf(quote.site),
      date: quote.date,
      text: quote.text,
    })),
  };
}

export function toVideoRow(video: OrgVideo, t: CabinetDictionary): VideoRow {
  return {
    id: video.id,
    url: video.url,
    title: video.title || video.url,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.durationSec ? formatTimecode(video.durationSec) : "",
    status: video.status,
    claims: video.claims,
    checked: video.checked,
    date: whenLabel(video.startedAt, t),
  };
}
