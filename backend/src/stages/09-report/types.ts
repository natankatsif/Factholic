import type { FactCheck } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { FoundSource, SearchReport } from "../04-source-search/types.ts";
import type { ProvenanceTree } from "../05-provenance/types.ts";
import type { MutationsOutput } from "../06-mutations/types.ts";
import type { RootDateOutput } from "../07-root-date/types.ts";
import type { StancesOutput } from "../08-stances/types.ts";

// ===================== ВХОД =====================

/** Всё, что выросло из дерева: само дерево и висящие на нём проверки (06, 07) */
export interface ProvenanceResult {
  tree: ProvenanceTree;
  /** null — этап 06 упал; дерево и дата корня всё равно показываются */
  mutations: MutationsOutput | null;
  rootDate: RootDateOutput;
}

/**
 * found   — найдено этапом 03, проверка ещё не запускалась (серое на таймкоде, проверится по запросу)
 * pending — проверка началась (фронт показывает лоадер на таймкоде)
 * checked — после этапов 05–08
 * failed  — 04 или 08 упали
 */
export type ReportInput =
  | { kind: "found"; claim: Claim }
  | { kind: "pending"; claim: Claim }
  | {
      kind: "checked";
      claim: Claim;
      /** Разнообразная выборка из 04 — карточки источников для «сторон» */
      sources: FoundSource[];
      stances: StancesOutput;
      /** null — дерево не построено (ошибка этапа 05); стороны всё равно показываются */
      provenance: ProvenanceResult | null;
      /** Итог «умного» поиска (этап 04): что не удалось подтвердить → «Недостаточно информации» */
      search?: SearchReport;
    }
  | { kind: "failed"; claim: Claim; error: string };

// ===================== ВЫХОД =====================

/**
 * ТО, ЧТО ПОЛУЧАЕТ ФРОНТ. Определено в packages/contracts/src/fact-check.ts.
 * Уходит в WS как ServerEvent "claim.detected" (pending) или "claim.checked" (checked/failed).
 * Мок для дизайна: packages/contracts/src/mocks/video-report.mock.ts
 */
export type ReportOutput = FactCheck;
