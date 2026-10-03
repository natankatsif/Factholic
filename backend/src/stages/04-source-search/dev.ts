/**
 * Ручной прогон real-реализации этапа (ключи — из корневого .env, STAGE_* не важен). Без аргумента ищет по тезису из мока этапа 03, с аргументом — по своему тексту:
 *   npm run stage:04 -w backend
 *   npm run stage:04 -w backend -- "Население Земли превысило 8 млрд человек в 2022 году."
 */
import { mockClaim } from "../03-claim-extraction/mock.ts";
import { searchSourcesReal } from "./real.ts";
import { mockSourceSearchInput } from "./mock.ts";
import type { SourceSearchInput } from "./types.ts";

const text = process.argv[2];
const input: SourceSearchInput = text
  ? {
      ...mockSourceSearchInput,
      claim: { ...mockClaim, quote: text, normalized: text, category: "other", entities: [] },
    }
  : mockSourceSearchInput;

const output = await searchSourcesReal(input, {
  jobId: "dev",
  signal: AbortSignal.timeout(120_000),
  log: console.log,
});
console.dir(output, { depth: null });
