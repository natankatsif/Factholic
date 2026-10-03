# @news/contracts — общие типы бэк ↔ фронт

Единственное место, где описано то, что ходит по сети. Меняем **только по договорённости всех троих**.

| Файл                             | Что внутри                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `src/common.ts`                  | `TimeRange`, `VideoRef`, `VideoInfo`, `formatTimecode()` / `formatRange()`     |
| `src/fact-check.ts`              | **`FactCheck`**, `Verdict`, `SourceCard`, `VideoReport` — то, что рисует фронт |
| `src/api.ts`                     | HTTP/WS протокол: `StartAnalysisRequest`, `ServerEvent`, `ClientMessage`       |
| `src/mocks/video-report.mock.ts` | **Мок для дизайна** — 8 тезисов во всех состояниях                             |
| `src/mocks/events.mock.ts`       | Тот же мок в виде потока WS-событий с задержками                               |

Внутренние типы этапов пайплайна (транскрипт, Claim, найденные источники и т.д.) сюда **не** кладём —
они в `backend/src/stages/*/types.ts`.

```ts
import type { FactCheck, VideoReport } from "@news/contracts";
import { MOCK_VIDEO_REPORT } from "@news/contracts/mocks";
```
