import { z } from "zod";
import type { Stage } from "../../pipeline/context.ts";
import type { ClaimStructure } from "../03-claim-extraction/types.ts";
import { VIDEO_NODE_ID, type TreeNode } from "../05-provenance/types.ts";
import { contradictsRoot, diffStructures, type DiffSide } from "./diff.ts";
import { askJson, LlmConfigError } from "./llm.ts";
import { buildPrompt, SYSTEM_PROMPT, type PromptPair } from "./prompt.ts";
import { templateNote } from "./texts.ts";
import type { ClaimMutation, MutationsInput, MutationsOutput } from "./types.ts";

/** LLM только подтверждает или отклоняет кандидатов кода; поле, направление и before / after — от кода */
const DecisionsSchema = z.object({
  decisions: z.array(z.object({ candidateId: z.string(), confirmed: z.boolean(), note: z.string() })),
});
type Decision = z.infer<typeof DecisionsSchema>["decisions"][number];

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_MUTATIONS=real).
 *  1. Пары: каждое ребро дерева (parentId → id), где структура есть у обоих, + корень → "video",
 *     если такого ребра нет (у видео без structure — structure тезиса из этапа 03).
 *  2. Код сравнивает поля (diff.ts) и выдаёт кандидатов с before / after и direction;
 *     у пары корень → видео — только расхождения с первой публикацией (contradictsRoot).
 *     Нет кандидатов — LLM не вызываем.
 *  3. Один вызов LLM на все пары: подтвердить / отклонить каждого кандидата и написать note на uiLanguage.
 *     Кандидат, которого LLM пропустила, остаётся (note — шаблонный).
 *  4. LLM не ответила (кроме отмены и ошибки настройки) — кандидаты кода с шаблонными note.
 */
export const findMutationsReal: Stage<MutationsInput, MutationsOutput> = async (input, ctx) => {
  const { claim, uiLanguage } = input;
  const pairs: PromptPair[] = [];
  let count = 0;
  for (const { wholePath, ...pair } of comparablePairs(input)) {
    const candidates = diffStructures(side(pair.from, pair.parent), side(pair.to, pair.child), uiLanguage)
      .filter((c) => !wholePath || contradictsRoot(c))
      .map((c) => ({ ...c, id: `c${++count}` }));
    if (candidates.length) pairs.push({ ...pair, id: `p${pairs.length + 1}`, candidates });
  }
  if (!pairs.length) {
    ctx.log(`06: ${claim.id}: перепечатывали без изменений`);
    return { claimId: claim.id, mutations: [] };
  }

  let decisions: Map<string, Decision> | null = null;
  try {
    const { data } = await askJson(
      {
        effort: "low",
        system: SYSTEM_PROMPT,
        prompt: buildPrompt({ claim, uiLanguage, pairs }),
        schema: DecisionsSchema,
      },
      ctx,
    );
    decisions = new Map();
    for (const d of data.decisions) if (!decisions.has(d.candidateId)) decisions.set(d.candidateId, d);
  } catch (err) {
    // ошибка настройки (.env) — пусть её заметят; временный сбой — показываем то, что нашёл код
    if (ctx.signal.aborted || err instanceof LlmConfigError) throw err;
    ctx.log("06: LLM не ответила, мутации — по сравнению полей кодом", err);
  }

  const mutations: ClaimMutation[] = [];
  for (const pair of pairs) {
    for (const { id, ...candidate } of pair.candidates) {
      const decision = decisions?.get(id);
      if (decision && !decision.confirmed) continue;
      mutations.push({
        fromId: pair.from.id,
        toId: pair.to.id,
        ...candidate,
        note: decision?.note.trim() || templateNote(candidate, uiLanguage),
      });
    }
  }
  ctx.log(`06: ${claim.id}: пар ${pairs.length}, кандидатов ${count}, мутаций ${mutations.length}`);
  return { claimId: claim.id, mutations };
};

interface NodePair {
  from: TreeNode;
  to: TreeNode;
  parent: ClaimStructure;
  child: ClaimStructure;
  /** Корень → видео через перепечатки, а не ребро дерева: кандидаты — только contradictsRoot */
  wholePath: boolean;
}

function comparablePairs({ claim, tree }: MutationsInput): NodePair[] {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  // этап 05 может не заполнить структуру видео — тогда она та, что извлёк этап 03
  const structureOf = (n: TreeNode) =>
    n.structure ?? (n.id === VIDEO_NODE_ID ? (claim.structure ?? null) : null);

  const pairs: NodePair[] = [];
  const add = (from: TreeNode | undefined, to: TreeNode | undefined, wholePath: boolean) => {
    if (!from || !to || from.id === to.id) return;
    const parent = structureOf(from);
    const child = structureOf(to);
    if (parent && child) pairs.push({ from, to, parent, child, wholePath });
  };

  for (const node of tree.nodes) {
    if (node.parentId !== null) add(byId.get(node.parentId), node, false);
  }
  // весь путь целиком: что дошло до видео от первой публикации
  const video = byId.get(VIDEO_NODE_ID);
  if (tree.rootId !== null && video && video.parentId !== tree.rootId)
    add(byId.get(tree.rootId), video, true);
  return pairs;
}

function side(node: TreeNode, structure: ClaimStructure): DiffSide {
  return { structure, publishedAt: node.publishedAt, publisher: node.publisher, domain: node.domain };
}
