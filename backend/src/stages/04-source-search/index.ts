import { selectImpl } from "../../config.ts";
import { searchSourcesMock } from "./mock.ts";
import { searchSourcesReal } from "./real.ts";
import type { SourceSearchInput, SourceSearchOutput } from "./types.ts";

export type * from "./types.ts";

/** mock или real — по STAGE_SOURCE_SEARCH в .env (см. backend/src/config.ts) */
export const searchSources = selectImpl<SourceSearchInput, SourceSearchOutput>("sourceSearch", {
  mock: searchSourcesMock,
  real: searchSourcesReal,
});
