import { selectImpl } from "../../config.ts";
import { verifyMock } from "./mock.ts";
import { verifyReal } from "./real.ts";
import type { VerificationInput, VerificationOutput } from "./types.ts";

export type * from "./types.ts";

/** mock или real — по STAGE_VERIFICATION в .env (см. backend/src/config.ts) */
export const verify = selectImpl<VerificationInput, VerificationOutput>("verification", {
  mock: verifyMock,
  real: verifyReal,
});
