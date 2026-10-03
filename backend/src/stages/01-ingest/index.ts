import { selectImpl } from "../../config.ts";
import { ingestMock } from "./mock.ts";
import { ingestReal } from "./real.ts";
import type { IngestInput, IngestOutput } from "./types.ts";

export type * from "./types.ts";

/** mock или real — по STAGE_INGEST в .env (см. backend/src/config.ts) */
export const ingest = selectImpl<IngestInput, IngestOutput>("ingest", { mock: ingestMock, real: ingestReal });
