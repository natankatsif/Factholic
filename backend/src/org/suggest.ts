/**
 * Предложение группы: утверждения, которые опираются на одни и те же публикации или цитаты.
 * Это только подсказка без LLM: собрать нарратив решает человек.
 */
import type { FactCheck } from "@news/contracts";
import type { NarrativeQuote } from "./types.ts";

/** Сколько общих публикаций или редких цепочек слов нужно, чтобы считать утверждения похожими */
const MIN_SHARED_URLS = 1;
const MIN_SHARED_PHRASES = 2;
const PHRASE_WORDS = 5;
const MAX_QUOTES = 6;

export interface SuggestInput {
  claimId: string;
  factCheck: FactCheck;
}

export interface SuggestedGroup {
  claimIds: string[];
  quotes: NarrativeQuote[];
}

const publications = (factCheck: FactCheck) =>
  (factCheck.provenance?.nodes ?? []).filter((node) => node.role !== "target" && node.quote);

function phrases(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\d]+/gu) ?? [];
  const result = new Set<string>();
  for (let index = 0; index + PHRASE_WORDS <= words.length; index++) {
    result.add(words.slice(index, index + PHRASE_WORDS).join(" "));
  }
  return result;
}

function urlsOf(factCheck: FactCheck): Set<string> {
  return new Set(publications(factCheck).flatMap((node) => (node.url ? [node.url] : [])));
}

function phrasesOf(factCheck: FactCheck): Set<string> {
  return new Set(publications(factCheck).flatMap((node) => [...phrases(node.quote)]));
}

const shared = (a: Set<string>, b: Set<string>) => [...a].filter((item) => b.has(item));

function similar(a: FactCheck, b: FactCheck): boolean {
  return (
    shared(urlsOf(a), urlsOf(b)).length >= MIN_SHARED_URLS ||
    shared(phrasesOf(a), phrasesOf(b)).length >= MIN_SHARED_PHRASES
  );
}

/** Цитаты, на которых основано сходство: сначала общие публикации */
function quotesOf(items: SuggestInput[]): NarrativeQuote[] {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const nodes = items.flatMap((item) => publications(item.factCheck));
  for (const node of nodes) counts.set(node.url ?? node.id, (counts.get(node.url ?? node.id) ?? 0) + 1);
  return [...nodes]
    .sort((a, b) => (counts.get(b.url ?? b.id) ?? 0) - (counts.get(a.url ?? a.id) ?? 0))
    .filter((node) => {
      const key = node.url ?? node.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUOTES)
    .map((node) => ({ url: node.url, site: node.name, date: node.date, text: node.quote }));
}

/** Группы похожих утверждений: связные компоненты по попарному сходству */
export function suggestGroups(items: SuggestInput[]): SuggestedGroup[] {
  const parent = new Map(items.map((item) => [item.claimId, item.claimId]));
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    return next === id ? id : find(next);
  };
  items.forEach((a, index) => {
    for (const b of items.slice(index + 1)) {
      if (similar(a.factCheck, b.factCheck)) parent.set(find(b.claimId), find(a.claimId));
    }
  });
  const groups = new Map<string, SuggestInput[]>();
  for (const item of items) {
    const root = find(item.claimId);
    groups.set(root, [...(groups.get(root) ?? []), item]);
  }
  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({ claimIds: group.map((item) => item.claimId).sort(), quotes: quotesOf(group) }));
}
