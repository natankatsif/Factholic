import type { SourceId } from "@news/contracts";
import type { FoundSource, SourceCopy } from "../04-source-search/types.ts";
import { canonicalUrl } from "./tree.ts";
import type { ProvenanceTree } from "./types.ts";

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
    ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}),
    excerpt: s.excerpt,
    outboundLinks: [],
    attributions: [],
    earliestSearch: false,
    retrievedAt: s.retrievedAt,
  }));
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
