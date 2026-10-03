import { selectImpl } from "../../config.ts";
import { buildProvenanceTreeMock } from "./mock.ts";
import { buildProvenanceTreeReal } from "./real.ts";
import type { ProvenanceInput, ProvenanceTree } from "./types.ts";

export type * from "./types.ts";
export { VIDEO_NODE_ID } from "./types.ts";

/** mock или real — по STAGE_PROVENANCE в .env (см. backend/src/config.ts) */
export const buildProvenanceTree = selectImpl<ProvenanceInput, ProvenanceTree>("provenance", {
  mock: buildProvenanceTreeMock,
  real: buildProvenanceTreeReal,
});
