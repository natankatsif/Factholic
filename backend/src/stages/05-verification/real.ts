import { z } from "zod";
import type { SourceStance, VerdictLabel } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import type { FoundSource } from "../04-source-search/types.ts";
import { askJson } from "./llm.ts";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { fitScore, LABELS } from "./scale.ts";
import { fixedTexts, type FixedVerdict } from "./texts.ts";
import type { SourceAssessment, VerificationInput, VerificationOutput } from "./types.ts";

const STANCES = ["supports", "refutes", "mixed", "neutral"] as const satisfies readonly SourceStance[];

/** Источник считается доказательством, если он не neutral и с relevance не ниже порога показа в 06 */
const MIN_EVIDENCE_RELEVANCE = 0.3;

/**
 * Какие позиции источников могут обосновать метку: «правда» — только подтверждающие, «ложь» — только
 * опровергающие. Иначе «true 10» при единственном опровергающем источнике прошло бы проверку.
 */
const EVIDENCE_FOR: Record<Exclude<VerdictLabel, "unverifiable">, readonly SourceStance[]> = {
  true: ["supports", "mixed"],
  mostly_true: ["supports", "mixed"],
  mixed: ["supports", "refutes", "mixed"],
  misleading: ["supports", "refutes", "mixed"],
  mostly_false: ["refutes", "mixed"],
  false: ["refutes", "mixed"],
};

const VerdictSchema = z.object({
  // сначала позиция каждого источника, потом итог — так модель приходит к вердикту от источников
  sourceAssessments: z.array(
    z.object({ sourceId: z.string(), stance: z.enum(STANCES), relevance: z.number() }),
  ),
  label: z.enum(LABELS),
  score: z.number().nullable(),
  confidence: z.number(),
  summary: z.string(),
  explanation: z.string(),
});

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_VERIFICATION=real).
 * LLM сопоставляет тезис с источниками. Код следит за принципами продукта:
 *  - нет источников → unverifiable без вызова LLM;
 *  - оценка без единого релевантного подтверждения/опровержения → unverifiable;
 *  - прогноз → unverifiable без вызова LLM;
 *  - score приводится к диапазону метки, sourceAssessments — ровно по одной на источник.
 */
export const verifyReal: Stage<VerificationInput, VerificationOutput> = async (input, ctx) => {
  const { claim, sources } = input;
  // прогноз проверить нельзя — не платим за вызов LLM, результат которого всё равно не используем
  if (claim.category === "prediction") return fixedVerdict(input, "prediction", "rules");
  if (!sources.length) return fixedVerdict(input, "no_sources", "rules");

  const { data, model } = await askJson(
    {
      effort: "medium",
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      schema: VerdictSchema,
    },
    ctx,
  );

  const sourceAssessments = alignAssessments(data.sourceAssessments, sources);
  if (data.label !== "unverifiable") {
    const hasEvidence = hasEvidenceFor(data.label, sourceAssessments);
    if (!hasEvidence) {
      ctx.log(`05: ${claim.id}: «${data.label}» без доказательств в источниках → unverifiable`);
      return fixedVerdict(input, "no_evidence", model, sourceAssessments);
    }
  }

  return {
    claimId: claim.id,
    score: fitScore(data.label, data.score),
    label: data.label,
    confidence: clamp01(data.confidence),
    summary: data.summary.trim(),
    explanation: data.explanation.trim(),
    sourceAssessments,
    model,
    checkedAt: new Date().toISOString(),
  };
};

/** По одной оценке на каждый входной источник; пропущенные LLM — neutral с relevance 0 (06 их скроет). */
function alignAssessments(raw: z.infer<typeof VerdictSchema>["sourceAssessments"], sources: FoundSource[]) {
  const byId = new Map<string, SourceAssessment>();
  for (const a of raw) {
    if (!byId.has(a.sourceId)) byId.set(a.sourceId, { ...a, relevance: clamp01(a.relevance) });
  }
  return sources.map(
    (s): SourceAssessment => byId.get(s.id) ?? { sourceId: s.id, stance: "neutral", relevance: 0 },
  );
}

function hasEvidenceFor(label: Exclude<VerdictLabel, "unverifiable">, assessments: SourceAssessment[]) {
  const allowed = EVIDENCE_FOR[label];
  return assessments.some((a) => allowed.includes(a.stance) && a.relevance >= MIN_EVIDENCE_RELEVANCE);
}

function fixedVerdict(
  input: VerificationInput,
  kind: FixedVerdict,
  model: string,
  sourceAssessments?: SourceAssessment[],
): VerificationOutput {
  return {
    claimId: input.claim.id,
    score: null,
    label: "unverifiable",
    confidence: kind === "no_evidence" ? 0.6 : 0.9,
    ...fixedTexts(kind, input.uiLanguage),
    sourceAssessments:
      sourceAssessments ??
      input.sources.map((s) => ({ sourceId: s.id, stance: "neutral" as const, relevance: 0 })),
    model,
    checkedAt: new Date().toISOString(),
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
