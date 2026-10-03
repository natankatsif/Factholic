import { selectImpl } from "../../config.ts";
import { findMutationsMock } from "./mock.ts";
import { findMutationsReal } from "./real.ts";
import type { MutationsInput, MutationsOutput } from "./types.ts";

export type * from "./types.ts";

/** mock или real — по STAGE_MUTATIONS в .env (см. backend/src/config.ts) */
export const findMutations = selectImpl<MutationsInput, MutationsOutput>("mutations", {
  mock: findMutationsMock,
  real: findMutationsReal,
});
