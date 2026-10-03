# backend

```
src/
├── server.ts                 HTTP + WS (POST /api/jobs, WS /api/jobs/:id/events)
├── pipeline/
│   ├── context.ts            Stage<I, O>, StageContext — общая сигнатура этапа
│   └── orchestrator.ts       связывает 01 → 06, шлёт ServerEvent во фронт
└── stages/
    ├── 01-ingest/            видео (URL / звук из вкладки) → куски звука или субтитры   [backend-1]
    ├── 02-transcription/     звук → текст с таймкодами                                   [backend-1]
    ├── 03-claim-extraction/  текст → проверяемые тезисы                                   [backend-2]
    ├── 04-source-search/     тезис → источники с разных точек зрения                      [backend-2]
    ├── 05-verification/      тезис + источники → оценка 0–10                              [backend-2]
    └── 06-delivery/          всё вместе → FactCheck для фронта                            [backend-1]
```

В каждой папке этапа одинаково:

| Файл        | Что                                             |
| ----------- | ----------------------------------------------- |
| `README.md` | что делает этап, требования                     |
| `types.ts`  | **вход и выход** этапа                          |
| `mock.ts`   | пример входа и выхода (живая документация)      |
| `index.ts`  | реализация. Сейчас — заглушка, возвращающая мок |

Этап = функция `Stage<Input, Output>` (`(input, ctx) => Promise<output>`). Этапы не знают друг о друге —
их связывает только `orchestrator.ts`. Поэтому каждый можно писать и тестировать отдельно, подставляя `mock.ts` предыдущего.

## Запуск

```bash
npm run dev        # реальный пайплайн (сейчас все этапы — заглушки)
npm run dev:mock   # проигрывает мок-события для фронта
```
