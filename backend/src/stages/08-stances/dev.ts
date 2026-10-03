/**
 * Ручной прогон real-реализации этапа (ключи — из корневого .env, STAGE_* не важен) на моке
 * (тезис из 03 + источники из 04 + группы независимости из 05). Из папки backend:
 *   npx tsx src/stages/08-stances/dev.ts
 * Чтобы проверить на реальных источниках, сохрани вывод этапа 04 в JSON и подставь в mock.ts локально.
 */
import { assessStancesReal } from "./real.ts";
import { mockStancesInput } from "./mock.ts";

const output = await assessStancesReal(mockStancesInput, {
  jobId: "dev",
  signal: AbortSignal.timeout(120_000),
  log: console.log,
});
console.dir(output, { depth: null });
