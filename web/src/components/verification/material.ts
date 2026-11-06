import type { ProvenanceNode, ProvenanceTree, VideoInfo } from "@news/contracts";

/** Что проверяем: видео, вставленный текст или статья по ссылке */
export type MaterialKind = "video" | "text" | "article";

/** Вставленный текст приходит с pageUrl "text:…"; статья — generic-страница без длительности */
export function materialKind(video: VideoInfo | undefined): MaterialKind {
  if (!video) return "video";
  if (video.pageUrl.startsWith("text:")) return "text";
  if (video.platform !== "generic" || video.durationSec > 0) return "video";
  return "article";
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
