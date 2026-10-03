# extension — Chrome Manifest V3

**Владелец:** frontend

```
src/
├── background/service-worker.ts   POST /api/jobs + WebSocket, пересылает события во вкладку
├── content/
│   ├── index.ts                   точка входа: нашёл видео → старт анализа → хранит Map<id, FactCheck>
│   ├── video-detector.ts          поиск <video>, определение платформы → VideoRef
│   └── overlay.ts                 UI поверх плеера (TODO) + activeAt(list, currentTime)
├── shared/messages.ts             сообщения content ↔ background
└── config.ts                      EXT_CONFIG: mock/backend и адрес бэкенда (из .env при сборке)
```

## Данные для дизайна

- Что рисовать: `FactCheck` в `packages/contracts/src/fact-check.ts`
- Мок: `MOCK_VIDEO_REPORT` в `packages/contracts/src/mocks/video-report.mock.ts`
  (8 тезисов: оценки 10, 9, 4, 2, 1, «непроверяемо», «проверяется…», «ошибка»)
- Таймкод строкой: `formatRange(fc.range)` → `"20:21–20:23"`

## Состояния карточки

| `status`   | `verdict`                      | Что показать                                                |
| ---------- | ------------------------------ | ----------------------------------------------------------- |
| `checking` | `null`                         | лоадер «Проверяем…» + цитата                                |
| `done`     | `score: 0–10`                  | оценка, label, summary, источники (раскрытие → explanation) |
| `done`     | `score: null` (`unverifiable`) | «Нельзя проверить»                                          |
| `failed`   | `null`                         | ошибка, `error`                                             |

`source.stance` (`supports` / `refutes` / `mixed` / `neutral`) — значок у каждого источника.

## Запуск

```bash
npm run build:ext          # из корня → extension/dist
# chrome://extensions → Режим разработчика → Загрузить распакованное → extension/dist
```

Режим задаётся в корневом `.env` и подставляется при сборке (`extension/build.mjs`):

- `EXT_DATA_SOURCE=mock` (по умолчанию) — события из `MOCK_EVENTS` прямо в расширении, бэкенд не нужен.
- `EXT_DATA_SOURCE=backend` + `EXT_BACKEND_URL=http://localhost:8787` — ходить на бэкенд
  (`npm run dev:mock` или `npm run dev`). `host_permissions` в `dist/manifest.json` подставятся под этот адрес.

После смены `.env` — пересобрать (`npm run build:ext`) и обновить расширение в `chrome://extensions`.

## Позже

- `live`-режим (видео с `blob:`): `chrome.tabCapture` + offscreen document → `ClientMessage "audio.chunk"`.
  Понадобятся permissions `tabCapture`, `offscreen`.
