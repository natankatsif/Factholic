import { config } from "../../config.ts";
import type { Stage } from "../../pipeline/context.ts";
import type { SourceSearchInput, SourceSearchOutput } from "./types.ts";

/**
 * REAL-РЕАЛИЗАЦИЯ (STAGE_SOURCE_SEARCH=real). TODO(backend-2)
 *  1. LLM (config.providers.llm) генерирует 2–4 запроса на разных языках
 *  2. Поиск (config.providers.search: Tavily / Brave / Google Fact Check Tools API)
 *  3. Скачать страницы, вырезать релевантный excerpt
 *  4. Отобрать maxSources с максимальным разнообразием (тип, страна, язык)
 */
export const searchSourcesReal: Stage<SourceSearchInput, SourceSearchOutput> = async () => {
  const { provider } = config.providers.search;
  throw new Error(`04-source-search: real-реализация (${provider}) ещё не написана (TODO backend-2)`);
};
