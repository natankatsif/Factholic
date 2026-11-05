/**
 * Сравнение двух проверок одного утверждения: что изменилось с прошлого раза.
 * Числа — стартовые значения из контракта, их надо подобрать на реальных данных.
 */
import type { FactCheck, ProvenanceNode } from "@news/contracts";
import type { AlertParams, AlertPublication, OrgAlertImportance, OrgSides, OrgSignal } from "./types.ts";

const GROWTH_MIN_NEW = 5;
const GROWTH_RATIO = 2;
export const QUIET_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Дата публикации бывает без времени: допуск в сутки */
const DATE_SLACK_MS = DAY_MS;

export interface Signal {
  type: OrgSignal;
  importance: OrgAlertImportance;
  params: AlertParams;
  nodeIds: string[];
}

export function sidesOf(factCheck: FactCheck): OrgSides | undefined {
  const sides = factCheck.sides;
  if (!sides) return undefined;
  const counted = factCheck.sources.filter((source) => source.stance === "neutral").length;
  return { for: sides.for, against: sides.against, partial: sides.mixed, neutral: counted };
}

const publications = (factCheck: FactCheck) =>
  (factCheck.provenance?.nodes ?? []).filter((node) => node.role !== "target" && node.url);

const keyOf = (node: ProvenanceNode) => (node.url ?? node.id).replace(/[#?].*$/, "").replace(/\/$/, "");

function hostOf(url?: string): string {
  try {
    return new URL(url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function languagesOf(factCheck: FactCheck): Map<string, string> {
  return new Map(factCheck.sources.map((source) => [source.url, source.language]));
}

const publicationOf = (node: ProvenanceNode): AlertPublication => ({
  nodeId: node.id,
  name: node.name,
  date: node.date,
  url: node.url,
});

const primaryOf = (factCheck: FactCheck) => factCheck.provenance?.nodes.find((node) => node.isPrimary);

/** Узел, к которому пришли новые публикации: родитель первой из них, иначе самая ранняя */
function parentOf(factCheck: FactCheck, nodeIds: string[]): string | undefined {
  const edge = factCheck.provenance?.edges.find(
    (item) => nodeIds.includes(item.toNodeId) && !nodeIds.includes(item.fromNodeId),
  );
  return edge?.fromNodeId ?? primaryOf(factCheck)?.id;
}

export interface CompareInput {
  before: FactCheck;
  after: FactCheck;
  /** Когда была прошлая проверка */
  since: string;
  /** Сколько дней прошло между проверками */
  days: number;
  /** Обычно новых публикаций в день */
  usualPerDay: number;
  /** Издания из списка организации */
  bigOutlets?: string[];
}

export function compareChecks({
  before,
  after,
  since,
  days,
  usualPerDay,
  bigOutlets = [],
}: CompareInput): Signal[] {
  const signals: Signal[] = [];
  const known = new Set(publications(before).map(keyOf));
  const unseen = publications(after).filter((node) => !known.has(keyOf(node)));
  // Поиск каждый раз находит немного другое. Незнакомый адрес ещё не новость: история растёт только тогда,
  // когда публикация вышла после прошлой проверки. Без даты этого не доказать
  const from = new Date(since).getTime() - DATE_SLACK_MS;
  const fresh = unseen.filter((node) => node.isoDate && new Date(node.isoDate).getTime() >= from);
  const freshIds = fresh.map((node) => node.id);

  if (fresh.length > 0) {
    const params: AlertParams = {
      count: fresh.length,
      publications: fresh.map(publicationOf),
      parentNodeId: parentOf(after, freshIds),
    };
    signals.push({ type: "new_publications", importance: "info", params, nodeIds: freshIds });

    const perDay = fresh.length / Math.max(days, 1);
    if (fresh.length >= GROWTH_MIN_NEW && perDay >= usualPerDay * GROWTH_RATIO) {
      signals.push({
        type: "growth",
        importance: "notable",
        params: { ...params, usual: Math.round(usualPerDay) },
        nodeIds: freshIds,
      });
    }
  }

  const oldLanguages = new Set(before.sources.map((source) => source.language));
  const languages = languagesOf(after);
  const byLanguage = new Map<string, ProvenanceNode[]>();
  for (const node of fresh) {
    const language = languages.get(node.url ?? "");
    if (language && !oldLanguages.has(language)) {
      byLanguage.set(language, [...(byLanguage.get(language) ?? []), node]);
    }
  }
  for (const [language, nodes] of byLanguage) {
    signals.push({
      type: "new_language",
      importance: "notable",
      params: { language, count: nodes.length, publications: nodes.map(publicationOf) },
      nodeIds: nodes.map((node) => node.id),
    });
  }

  for (const node of fresh) {
    if (bigOutlets.includes(hostOf(node.url))) {
      signals.push({
        type: "new_outlet",
        importance: "notable",
        params: { outlet: node.name, publications: [publicationOf(node)] },
        nodeIds: [node.id],
      });
    }
  }

  // разбор важен, даже если вышел раньше: о нём просто не знали
  const debunks = unseen.filter(
    (node) => node.category === "fact_checker" || node.categoryLabel === "разбор",
  );
  for (const node of debunks) {
    signals.push({
      type: "debunk_found",
      importance: "info",
      params: { outlet: node.name, date: node.date, publications: [publicationOf(node)] },
      nodeIds: [node.id],
    });
  }

  const changed = fresh.filter((node) => (node.tags?.length ?? 0) > 0);
  if (changed.length > 0) {
    signals.push({
      type: "changed_detail",
      importance: "notable",
      params: {
        outlet: changed[0]!.name,
        after: changed[0]!.tags?.[0],
        publications: changed.map(publicationOf),
      },
      nodeIds: changed.map((node) => node.id),
    });
  }

  if (before.consensus !== after.consensus) {
    signals.push({
      type: "sides_changed",
      importance: "notable",
      params: { before: before.consensus, after: after.consensus },
      nodeIds: [],
    });
  }

  const oldRoot = primaryOf(before);
  const newRoot = primaryOf(after);
  if (
    newRoot?.isoDate &&
    (!oldRoot?.isoDate || new Date(newRoot.isoDate).getTime() < new Date(oldRoot.isoDate).getTime())
  ) {
    signals.push({
      type: "earlier_found",
      importance: "notable",
      params: { outlet: newRoot.name, date: newRoot.date },
      nodeIds: [newRoot.id],
    });
  }

  return signals;
}

/** Новых публикаций нет дольше QUIET_DAYS */
export function isQuiet(lastNewAt: string, now: Date): boolean {
  return now.getTime() - new Date(lastNewAt).getTime() >= QUIET_DAYS * DAY_MS;
}

export const daysBetween = (from: string, to: Date) =>
  Math.max((to.getTime() - new Date(from).getTime()) / DAY_MS, 0);
