/**
 * Подписи отчёта пишутся на языке, на котором запустили проверку. Если потом сменить язык, старый отчёт
 * остался бы на прежнем. Поэтому отдаём фронту таблицу: подпись на любом языке → подпись на нужном.
 * Текст модели и цитаты сюда не входят: их перевод был бы уже другим текстом.
 */
import type { LanguageCode } from "@news/contracts";
import { textsFor as mutationTexts } from "../stages/06-mutations/texts.ts";
import { fixedTexts, type FixedStances } from "../stages/08-stances/texts.ts";
import { textsFor as reportTexts } from "../stages/09-report/texts.ts";

const LANGUAGES: LanguageCode[] = ["ru", "ro", "en"];
const FIXED_STANCES: FixedStances[] = ["no_sources", "few_sources", "prediction"];
/** Метки на месте значений в шаблонах: фронт подставляет на них найденные куски */
export const SLOTS = ["", "", "", ""];

export interface ReportLabels {
  exact: Record<string, string>;
  patterns: Array<{ from: string; to: string }>;
}

type Leaf = string | ((...args: never[]) => unknown);

function leaves(value: unknown, path = ""): Array<[string, Leaf]> {
  if (typeof value === "string" || typeof value === "function") return [[path, value as Leaf]];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => leaves(item, `${path}/${key}`));
}

function textsOf(language: LanguageCode): unknown {
  return {
    report: reportTexts(language),
    mutations: mutationTexts(language),
    stances: Object.fromEntries(FIXED_STANCES.map((kind) => [kind, fixedTexts(kind, language)])),
  };
}

function filled(leaf: Leaf): string | undefined {
  if (typeof leaf === "string") return undefined;
  try {
    const result = (leaf as (...args: string[]) => unknown)(...SLOTS.slice(0, leaf.length));
    return typeof result === "string" && SLOTS.some((slot) => result.includes(slot)) ? result : undefined;
  } catch {
    return undefined; // шаблон считает по числам: такие подписи остаются как есть
  }
}

export function reportLabels(target: LanguageCode): ReportLabels {
  const wanted = new Map(leaves(textsOf(target)));
  const labels: ReportLabels = { exact: {}, patterns: [] };
  for (const language of LANGUAGES.filter((item) => item !== target)) {
    for (const [path, leaf] of leaves(textsOf(language))) {
      const to = wanted.get(path);
      if (to === undefined) continue;
      if (typeof leaf === "string" && typeof to === "string") {
        if (leaf !== to) labels.exact[leaf] = to;
        continue;
      }
      const from = filled(leaf);
      const result = filled(to);
      if (from && result && from !== result) labels.patterns.push({ from, to: result });
    }
  }
  return labels;
}
