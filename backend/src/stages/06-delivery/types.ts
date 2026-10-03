import type { FactCheck } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { FoundSource } from "../04-source-search/types.ts";
import type { VerificationOutput } from "../05-verification/types.ts";

// ===================== ВХОД =====================

/**
 * pending — сразу после этапа 03 (фронт показывает лоадер на таймкоде)
 * checked — после этапа 05
 * failed  — 04 или 05 упали
 */
export type DeliveryInput =
  | { kind: "pending"; claim: Claim }
  | { kind: "checked"; claim: Claim; sources: FoundSource[]; verification: VerificationOutput }
  | { kind: "failed"; claim: Claim; error: string };

// ===================== ВЫХОД =====================

/**
 * ТО, ЧТО ПОЛУЧАЕТ ФРОНТ. Определено в packages/contracts/src/fact-check.ts.
 * Уходит в WS как ServerEvent "claim.detected" (pending) или "claim.checked" (checked/failed).
 * Мок для дизайна: packages/contracts/src/mocks/video-report.mock.ts
 */
export type DeliveryOutput = FactCheck;
