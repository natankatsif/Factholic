import type { Stage } from "../../pipeline/context.ts";
import { mockSourceSearchOutput } from "./mock.ts";
import type { SourceSearchInput, SourceSearchOutput } from "./types.ts";

export type * from "./types.ts";

/**
 * TODO(backend-2): реализовать.
 *  1. LLM генерирует 2–4 запроса на разных языках
 *  2. Поиск (Tavily / Brave / Google Fact Check Tools API)
 *  3. Скачать страницы, вырезать релевантный excerpt
 *  4. Отобрать maxSources с максимальным разнообразием (тип, страна, язык)
 */
export const searchSources: Stage<SourceSearchInput, SourceSearchOutput> = async (input) => {
  return { ...mockSourceSearchOutput, claimId: input.claim.id };
};
