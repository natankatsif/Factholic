/**
 * Шкала score ↔ label из README этапа. Диапазоны misleading/mixed/mostly_false пересекаются намеренно:
 * misleading — это про подачу («факт верен, вывод нет»), а не про степень ложности.
 * LLM выбирает и метку, и оценку; код только приводит оценку в диапазон метки.
 */
import type { VerdictLabel } from "@news/contracts";

export const LABELS = [
  "true",
  "mostly_true",
  "mixed",
  "misleading",
  "mostly_false",
  "false",
  "unverifiable",
] as const satisfies readonly VerdictLabel[];

export const SCORE_RANGE: Record<Exclude<VerdictLabel, "unverifiable">, [min: number, max: number]> = {
  true: [9, 10],
  mostly_true: [7, 8],
  mixed: [5, 6],
  misleading: [3, 5],
  mostly_false: [2, 4],
  false: [0, 1],
};

/** null для unverifiable, иначе целое в диапазоне метки (без оценки — середина диапазона) */
export function fitScore(label: VerdictLabel, score: number | null): number | null {
  if (label === "unverifiable") return null;
  const [min, max] = SCORE_RANGE[label];
  if (score === null || !Number.isFinite(score)) return Math.round((min + max) / 2);
  return Math.min(max, Math.max(min, Math.round(score)));
}
