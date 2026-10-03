/**
 * Конфигурация расширения. Значения подставляет extension/build.mjs при сборке
 * из корневого .env (EXT_DATA_SOURCE, EXT_BACKEND_URL). Шаблон — .env.example.
 * В рантайме расширения process.env нет, поэтому только так.
 */
declare const __EXT_DATA_SOURCE__: "mock" | "backend";
declare const __EXT_BACKEND_URL__: string;

export const EXT_CONFIG = {
  /** mock — проигрывать MOCK_EVENTS прямо в service worker; backend — ходить на backendUrl */
  dataSource: __EXT_DATA_SOURCE__,
  backendUrl: __EXT_BACKEND_URL__,
} as const;
