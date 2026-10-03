# AGENTS.md — extension (Chrome Manifest V3)

Общий контекст — в корневом `AGENTS.md`. Здесь — правила зоны фронтенда. Владелец: frontend.

## Устройство

- `src/background/service-worker.ts` — одно WS-соединение на вкладку, пересылает `ServerEvent` в content script.
- `src/content/index.ts` — точка входа: находит видео, стартует анализ, держит `Map<id, FactCheck>`,
  шлёт позицию плеера.
- `src/content/video-detector.ts` — поиск основного `<video>`, определение платформы → `VideoRef`.
- `src/content/overlay.ts` — UI поверх плеера (**TODO**), `activeAt(list, currentTime)`.
- `src/shared/messages.ts` — сообщения content ↔ background (внутренние, бэкенд о них не знает).
- `src/config.ts` — `EXT_CONFIG` (`dataSource`, `backendUrl`). Значения подставляет `build.mjs` из `.env`.
  Настройки расширения читаются **только** отсюда, не хардкодить URL и флаги в коде.

## Правила

1. Фронт знает **только** `@news/contracts`: `FactCheck`, `VideoReport`, `ServerEvent`, `ClientMessage`.
   Не импортировать ничего из `backend/`.
2. Состояние — `Map<id, FactCheck>`; `claim.detected` и `claim.checked` с тем же `id` **заменяют** объект.
3. Показ на таймкоде: `currentTime ∈ [range.start, range.end + LINGER_SEC]`. Таймкод строкой — `formatRange()`.
4. Все состояния карточки должны быть нарисованы: `checking`, `done` со сторонами (`consensus.status`: agree / split /
   mostly_against / few_sources) и деревом (`provenance`: таймлайн, флаги «старый контент» / «раздули»), `failed`.
   `verdict` (0–10) — старая концепция, всегда `null`. Данные для всех — в `MOCK_VIDEO_REPORT` (дерево — `clm_05`, `clm_09`).
5. UI в content script — внутри **Shadow DOM**, чтобы стили сайта не ломали оверлей и наоборот.
6. Не перекрывать элементы управления и субтитры плеера; учитывать полноэкранный режим.
7. SPA-навигация (YouTube меняет видео без перезагрузки) — переподключаться к новому видео.
8. MV3: service worker может быть выгружен — не хранить важное состояние только в памяти воркера.
9. Новые permissions в `manifest.json` — минимально необходимые, с комментарием в PR зачем.

## Разработка без бэкенда

`EXT_DATA_SOURCE=mock` в корневом `.env` (по умолчанию) → события идут из `MOCK_EVENTS` прямо в service worker.
С бэкендом: `EXT_DATA_SOURCE=backend` + `npm run dev:mock`. После смены `.env` — пересобрать.

```bash
npm run build:ext          # → extension/dist, загрузить в chrome://extensions
npm run check -- extension
```
