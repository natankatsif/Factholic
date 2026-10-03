# FactCheck Video — проверка фактов в видео

Chrome-расширение: на любом сайте находит видео, расшифровывает речь, выделяет утверждения,
ищет источники с разных точек зрения и прямо во время просмотра показывает на нужном таймкоде
оценку достоверности (например, 9/10) и источники.

## Пайплайн

```
 [extension]                                [backend]
 нашёл <video> ──POST /api/jobs──▶  01 ingest           видео → куски звука/субтитров по 30 с
                                         │ MediaChunk
                                    02 transcription    → текст с таймкодами
                                         │ TranscriptSegment[]
                                    03 claim-extraction → тезисы ─────────────┐
                                         │ Claim                              │ claim.detected (лоадер)
                                    04 source-search    → источники           │
                                         │ FoundSource[]                      │
                                    05 verification     → оценка 0–10         │
                                         │ VerificationOutput                 │
 оверлей на таймкоде ◀──WS───────── 06 delivery         → FactCheck ◀─────────┘ claim.checked
```

## Структура

```
packages/contracts/    общие типы бэк↔фронт + МОКИ ДЛЯ ДИЗАЙНА            [все трое, менять по договорённости]
backend/src/stages/    по папке на этап: README, types.ts (вход/выход), mock.ts, real.ts, index.ts
backend/src/config.ts  единый конфиг бэкенда (mock/real по этапам, ключи) из корневого .env
backend/src/pipeline/  оркестратор, связывающий этапы
extension/             Chrome MV3                                          [frontend]
```

## Роли и распределение папок

Команда: 2 бэкенд-разработчика + 1 фронтенд. Выберите, кто берёт какой профиль бэкенда, и впишите имена.

| Роль                               | Кто   | Папки                                                                                                                  |
| ---------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| **backend-1** — Медиа и платформа  | _____ | `backend/src/stages/01-ingest/`, `02-transcription/`, `06-delivery/`, `backend/src/pipeline/`, `backend/src/server.ts` |
| **backend-2** — AI и фактчекинг    | _____ | `backend/src/stages/03-claim-extraction/`, `04-source-search/`, `05-verification/`                                     |
| **frontend** — Расширение и дизайн | _____ | `extension/`                                                                                                           |
| общее, только по договорённости    | все   | `packages/contracts/`, корневые конфиги, `scripts/`                                                                    |

Каждый этап — отдельная функция с типизированным входом/выходом. Каждый этап включается в `mock` или `real` отдельно через `.env`,
поэтому весь пайплайн запускается end-to-end с первого дня, и никто никого не ждёт.

### 🎬 backend-1 — Медиа и платформа

**Задача одной фразой:** превратить любое видео в текст с точными таймкодами и доставить результаты во фронт в реальном времени.

**Папки:**

```
backend/src/stages/01-ingest/          видео → куски звука / субтитров
backend/src/stages/02-transcription/   звук → текст с таймкодами
backend/src/stages/06-delivery/        результат → FactCheck для фронта (уже готов, поддержка)
backend/src/pipeline/                  оркестратор: порядок этапов, параллельность, отмена
backend/src/server.ts                  HTTP + WebSocket
```

**Что сделать:**

- скачивание видео и субтитров (`yt-dlp`), конвертация и нарезка звука (`ffmpeg`, 16 kHz mono, куски ~30 с);
- распознавание речи с пословными таймкодами (Whisper / Deepgram / AssemblyAI — выбрать);
- `live`-режим на стороне сервера: принять `audio.chunk` из WS и отдать в этап 01;
- перемотка: по `ClientMessage "playback"` переключать обработку на новый участок;
- кэш по видео (одно видео не обрабатываем дважды), хранилище результатов, `GET /api/jobs/:id`;
- деплой, логи, лимиты, обработка ошибок (`job.failed`).

**Получает от:** расширения — `StartAnalysisRequest`, `ClientMessage`; от backend-2 — `Claim`, `FoundSource[]`, `VerificationOutput`.
**Отдаёт:** backend-2 — `TranscriptionOutput` (сегменты с таймкодами); фронту — `ServerEvent` по WS.

**Профиль:** Node.js, потоки/async-итераторы, WebSocket, ffmpeg, работа с внешними API, Docker/деплой.

### 🧠 backend-2 — AI и фактчекинг

**Задача одной фразой:** по тексту из видео найти проверяемые утверждения, источники с разных точек зрения и честно оценить достоверность 0–10.

**Папки:**

```
backend/src/stages/03-claim-extraction/   текст → проверяемые тезисы
backend/src/stages/04-source-search/      тезис → 3–6 источников разных типов, стран, языков
backend/src/stages/05-verification/       тезис + источники → score 0–10, label, объяснение
```

**Что сделать:**

- промпты и structured output для LLM: выделение тезисов (факты — да, мнения — нет), точный `range` по словам;
- генерация поисковых запросов на нескольких языках, поисковый API (Tavily / Brave / Google Fact Check), загрузка страниц и вырезка релевантных фрагментов;
- отбор источников по разнообразию (тип, страна, язык, в том числе опровергающие) и справочник надёжности доменов;
- оценка: позиция каждого источника, `score` ↔ `label` по шкале, нейтральные `summary` / `explanation` на языке UI;
- качество: набор примеров тезисов с ожидаемыми оценками, чтобы мерить промпты.

**Получает от:** backend-1 — `TranscriptionOutput` (сегменты текста).
**Отдаёт:** backend-1 — `Claim[]`, `SourceSearchOutput`, `VerificationOutput` (оркестратор превращает это в `FactCheck`).

**Профиль:** LLM API и промпт-инжиниринг, structured output / JSON Schema, поисковые API, парсинг HTML, оценка качества моделей.

### 🎨 frontend — Расширение и дизайн

**Папки:** `extension/` (Chrome MV3: service worker, content script, оверлей поверх плеера).
**Задача:** найти видео на странице, показать карточку факта ровно на нужном таймкоде, дизайн всех состояний
(`checking`, оценки 0–10, «нельзя проверить», ошибка). Данные для дизайна — `MOCK_VIDEO_REPORT`.
**Получает:** `ServerEvent` / `FactCheck` из `@news/contracts`. **Отдаёт:** `StartAnalysisRequest`, `ClientMessage`.

### Где роли встречаются

```
frontend ──StartAnalysisRequest──▶ backend-1 ──TranscriptionOutput──▶ backend-2
frontend ◀──ServerEvent/FactCheck── backend-1 ◀──Claim, Sources, Verdict── backend-2
```

- Граница **backend-1 ↔ backend-2**: `02-transcription/types.ts` (что получает backend-2) и
  `03`/`04`/`05` `types.ts` (что получает оркестратор). Меняете — договариваетесь вдвоём.
- Граница **бэкенд ↔ фронт**: `packages/contracts/`. Меняется только втроём.
- Коммитит каждый сам свои папки; pre-commit проверяет только то, что вы коммитите (см. ниже).

## Для фронта / дизайна

- Модель: `packages/contracts/src/fact-check.ts` → `FactCheck`
- Мок: `packages/contracts/src/mocks/video-report.mock.ts` → `MOCK_VIDEO_REPORT`

## Команды

```bash
npm install         # заодно ставит git-хук pre-commit (husky)
npm run check       # tsc + eslint по всем юнитам, отчёт ✅/❌ по каждому
npm run check -- 03 # только юниты, где в id есть "03"
cp .env.example .env # настройки: mock/real по этапам, ключи API, режим расширения
npm run dev:mock    # бэкенд, проигрывающий мок-события (SERVER_MODE=replay)
npm run dev         # бэкенд с реальным пайплайном
npm run build:ext   # собрать расширение в extension/dist
```

## Коммиты делают люди, а не AI-агенты

Агенты (Claude Code, Codex, Cursor…) не коммитят и не пушат — только **предлагают** готовые команды
`git add …` + `git commit -m "…"`, а вы их выполняете из обычного терминала или IDE.
Для Claude Code это включено у всех через `.claude/settings.json` и `.husky/pre-commit`; подробно — в
[AGENTS.md](AGENTS.md#git-коммитит-только-человек).

## Pre-commit: проверки по юнитам, а не по всему репо

При `git commit` хук проверяет **только то, что ты коммитишь**:

1. `eslint --fix` + `prettier` — по застейдженным файлам.
2. `tsc` — по **юнитам**, которых касаются эти файлы (реестр в `scripts/units.mjs`).

Сломанный незакоммиченный код в чужом этапе твой коммит **не** блокирует. Свой сломанный — блокирует,
с указанием юнита и владельца. Изменение **контракта** (`packages/contracts/**`, `stages/*/types.ts`, `stages/*/mock.ts`)
дополнительно проверяет всех, кто от него зависит — нельзя молча сломать соседа.

Подробно — в [AGENTS.md](AGENTS.md#проверки-и-pre-commit).
