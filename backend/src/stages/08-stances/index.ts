import { selectImpl } from "../../config.ts";
import { assessStancesMock } from "./mock.ts";
import { assessStancesReal } from "./real.ts";
import type { StancesInput, StancesOutput } from "./types.ts";

export type * from "./types.ts";

/** mock или real — по STAGE_STANCES в .env (см. backend/src/config.ts) */
export const assessStances = selectImpl<StancesInput, StancesOutput>("stances", {
  mock: assessStancesMock,
  real: assessStancesReal,
});
