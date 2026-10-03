# backend

```
src/
├── server.ts                 HTTP + WS (POST /api/jobs, WS /api/jobs/:id/events)
├── pipeline/
│   ├── context.ts            Stage<I, O>, StageContext — общая сигнатура этапа
│   └── orchestrator.ts       связывает 01 → 09, шлёт ServerEvent во фронт
└── stages/
    ├── 01-ingest/            видео / пост / ссылка → куски; дата публикации               [backend-1]
    ├── 02-transcription/     текст: субтитры, Whisper, OCR                                  [backend-1]
    ├── 03-claim-extraction/  текст → утверждения + структура (цифры, места, время, «вчера») [backend-1]
    ├── 04-source-search/     источники ro/ru/en: sources (для сторон) + copies (для дерева) [backend-1]
    ├── 05-provenance/        copies → дерево первоисточника, корень, группы голосов        [backend-2]
    ├── 06-mutations/         где утверждение раздули по дороге                             [backend-2]
    ├── 07-root-date/         флаг «старый контент» (код, без LLM)                          [backend-2]
    ├── 08-stances/           стороны: сходятся / разделились / против / мало источников    [backend-2]
    └── 09-report/            всё вместе → FactCheck (consensus + provenance) для фронта    [backend-2]
```

В каждой папке этапа одинаково:

| Файл        | Что                                                               |
| ----------- | ----------------------------------------------------------------- |
| `README.md` | что делает этап, требования                                       |
| `types.ts`  | **вход и выход** этапа                                            |
| `mock.ts`   | пример входа и выхода (живая документация)                        |
| `real.ts`   | настоящая реализация (внешние API). Сейчас — TODO, бросает ошибку |
| `index.ts`  | только выбор mock/real по `.env` через `selectImpl`               |

Этап = функция `Stage<Input, Output>` (`(input, ctx) => Promise<output>`). Этапы не знают друг о друге —
их связывает только `orchestrator.ts`. Поэтому каждый можно писать и тестировать отдельно, подставляя `mock.ts` предыдущего.

## Запуск

```bash
npm run dev        # пайплайн; mock/real каждого этапа — по .env (по умолчанию все mock)
npm run dev:mock   # SERVER_MODE=replay — проигрывает мок-события для фронта
```
