/**
 * Ручной прогон real-реализации этапа (ключи — из корневого .env, STAGE_* не важен) — для подбора промпта. Без аргумента берёт мок этапа 02, с аргументом — свой текст:
 *   npm run stage:03 -w backend
 *   npm run stage:03 -w backend -- "В прошлом году население Индии обогнало Китай, их уже 1,5 миллиарда."
 */
import { extractClaimsReal } from "./real.ts";
import { mockClaimExtractionInput } from "./mock.ts";
import type { ClaimExtractionInput } from "./types.ts";

const text = process.argv[2];
const input: ClaimExtractionInput = text
  ? { ...mockClaimExtractionInput, previousClaims: [], segments: [{ id: "0_0", start: 0, end: 10, text }] }
  : mockClaimExtractionInput;

const output = await extractClaimsReal(input, {
  jobId: "dev",
  signal: AbortSignal.timeout(120_000),
  log: console.log,
});
console.dir(output, { depth: null });
