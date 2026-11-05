import type { ProvenanceNode, ProvenanceTree, VideoInfo } from "@news/contracts";
import type { SiteDictionary } from "../../i18n/site";

/** Что проверяем: видео, вставленный текст или статья по ссылке */
export type MaterialKind = "video" | "text" | "article";

/** Вставленный текст приходит с pageUrl "text:…"; статья — generic-страница без длительности */
export function materialKind(video: VideoInfo | undefined): MaterialKind {
  if (!video) return "video";
  if (video.pageUrl.startsWith("text:")) return "text";
  if (video.platform !== "generic" || video.durationSec > 0) return "video";
  return "article";
}

/**
 * Узел самого материала в дереве: бэкенд всегда отдаёт «Это видео» по-русски, с плашкой «СМИ» и ссылкой на фрагмент: подпись ставим здесь.
 * Для текста ссылки нет (pageUrl — заглушка "text:…"), для статьи — ссылка на страницу.
 */
export function materialNode(node: ProvenanceNode, kind: MaterialKind, t: SiteDictionary): ProvenanceNode {
  if (node.role !== "target") return node;
  const name = t.text.material[kind];
  const shortCode = name.slice(0, 2).toUpperCase();
  if (kind === "video") return { ...node, name, shortCode, categoryLabel: undefined };
  const url = kind === "article" && node.url?.startsWith("http") ? node.url : undefined;
  return {
    ...node,
    name,
    shortCode,
    categoryLabel: undefined,
    url,
    action: url ? { type: "open_source", label: t.text.openArticle, url } : undefined,
  };
}

/** Публикации дерева без самого материала: если их нет, дерева по сути нет */
export function publicationNodes(tree: ProvenanceTree | undefined): ProvenanceNode[] {
  return tree?.nodes.filter((n) => n.role !== "target") ?? [];
}

/**
 * Дерево построено, если есть хоть одна связь или первоисточник — публикация, где утверждение уже есть.
 * Ни того ни другого — найденные публикации только на ту же тему, а само утверждение никто не публиковал
 * (например, выдуманное): рисовать нечего, доказательства — в источниках с позициями.
 */
export function hasProvenanceTree(tree: ProvenanceTree | undefined): tree is ProvenanceTree {
  if (!tree || publicationNodes(tree).length === 0) return false;
  return tree.edges.length > 0 || (tree.primarySourceCount ?? 0) > 0 || tree.nodes.some((n) => n.isPrimary);
}
