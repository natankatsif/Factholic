/**
 * Ручной прогон real-реализации этапа (ключи — из корневого .env, STAGE_* не важен) на моке (тезис из 03 + источники из 04):
 *   npm run stage:05 -w backend
 * Чтобы проверить на реальных источниках, сохрани вывод `npm run stage:04` в JSON и подставь в mock.ts локально.
 */
import { verifyReal } from "./real.ts";
import { mockVerificationInput } from "./mock.ts";

const output = await verifyReal(mockVerificationInput, {
  jobId: "dev",
  signal: AbortSignal.timeout(120_000),
  log: console.log,
});
console.dir(output, { depth: null });
