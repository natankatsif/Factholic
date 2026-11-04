import type { SourceId } from "@news/contracts";
import type { FoundSource, SourceCopy } from "../04-source-search/types.ts";
import { canonicalUrl } from "./tree.ts";
import type { ProvenanceTree, TreeNode } from "./types.ts";

/**
 * Фолбэк, когда этап 04 не вернул `copies` (старые моки): источники как копии.
 * Ссылок и атрибуций у FoundSource нет — рёбра дерева тогда только по дублям текста и «по данным …» от LLM.
 */
export function copiesFromSources(sources: FoundSource[]): SourceCopy[] {
  return sources.map((s): SourceCopy => ({
    id: s.id,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    domain: s.domain,
    sourceType: s.sourceType,
    language: s.language,
    ...(s.publishedAt ? { publishedAt: s.publishedAt, dateSource: "search" as const } : {}),
    excerpt: s.excerpt,
    outboundLinks: [],
    attributions: [],
    earliestSearch: false,
    retrievedAt: s.retrievedAt,
  }));
}

/**
 * Копии для дерева: всё, что нашёл этап 04 в `copies`, плюс источники, которых среди копий нет (по URL).
 * Иначе пустые или неполные `copies` дают дерево без найденных источников — в отчёте «5 источников»,
 * а в дереве один узел «Это видео».
 */
export function copiesForTree(copies: SourceCopy[] | undefined, sources: FoundSource[]): SourceCopy[] {
  const known = new Set((copies ?? []).map((c) => canonicalUrl(c.url)));
  const missing = sources.filter((s) => !known.has(canonicalUrl(s.url)));
  return [...(copies ?? []), ...copiesFromSources(missing)];
}

/**
 * Группы голосов для «сторон» (этап 08) по id ИСТОЧНИКОВ. Дерево строится по копиям, а у этапа 04 id копий и
 * источников разные (`_cN` и `_sN`) — сопоставляем по канонизированному URL. Источник без копии — сам себе группа.
 */
export function voteGroupsForSources(
  tree: ProvenanceTree,
  copies: SourceCopy[],
  sources: FoundSource[],
): Record<SourceId, string> {
  const groupByUrl = new Map<string, string>();
  for (const c of copies) {
    const group = tree.voteGroups[c.id];
    if (group) groupByUrl.set(canonicalUrl(c.url), group);
  }
  const groups: Record<SourceId, string> = {};
  for (const s of sources)
    groups[s.id] = tree.voteGroups[s.id] ?? groupByUrl.get(canonicalUrl(s.url)) ?? s.id;
  return groups;
}

/** Всего голосующих источников: каждый — это текст в запросе к основной модели */
const MAX_VOTERS = 9;

/**
 * Голоса из дерева. Этап 04 отбирает источники на разнообразие, поэтому в них могут не попасть публикации,
 * которые прямо сообщают утверждение. От каждой независимой ветки дерева голосует её самая ранняя публикация:
 * перепечатки и так считаются одним голосом, поэтому запрос к LLM растёт на ветки, а не на копии.
 */
export function votersFromTree(
  tree: ProvenanceTree,
  copies: SourceCopy[],
  sources: FoundSource[],
  max = MAX_VOTERS,
): FoundSource[] {
  const byId = new Map(copies.map((c) => [c.id, c]));
  const taken = new Set(sources.map((s) => canonicalUrl(s.url)));
  const groups = new Set(Object.values(voteGroupsForSources(tree, copies, sources)));
  const voters: FoundSource[] = [];
  const candidates = tree.nodes.filter((n: TreeNode) => n.structure && n.relation !== "mentions");
  for (const node of candidates) {
    if (sources.length + voters.length >= max) break;
    const copy = byId.get(node.id);
    const group = tree.voteGroups[node.id];
    if (!copy?.voter || !group || groups.has(group) || taken.has(canonicalUrl(copy.url))) continue;
    groups.add(group);
    voters.push({
      id: copy.id,
      url: copy.url,
      title: copy.title,
      publisher: copy.publisher,
      domain: copy.domain,
      sourceType: copy.sourceType,
      language: copy.language,
      ...(copy.publishedAt ? { publishedAt: copy.publishedAt } : {}),
      excerpt: copy.excerpt,
      retrievedAt: copy.retrievedAt,
      ...copy.voter,
    });
  }
  return voters;
}
