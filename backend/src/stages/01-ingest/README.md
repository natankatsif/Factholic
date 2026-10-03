# 01 — Ingest: видео → куски звука / субтитров

**Владелец:** backend-1

Получает запрос от расширения и превращает видео в поток кусков по ~30 секунд,
начиная с позиции, где пользователь сейчас смотрит (`startFrom`).

|        | Тип                                                        | Файл       |
| ------ | ---------------------------------------------------------- | ---------- |
| Вход   | `IngestInput`                                              | `types.ts` |
| Выход  | `IngestOutput` = `VideoInfo` + `AsyncIterable<MediaChunk>` | `types.ts` |
| Пример | `mockIngestInput`, `mockCaptionsChunk`                     | `mock.ts`  |
| Mock   | `STAGE_INGEST=mock` → mock-функция в конце `mock.ts`       | `mock.ts`  |
| Real   | `STAGE_INGEST=real` в `.env`, нужны: —                     | `real.ts`  |

## Два режима

- **remote** (YouTube и всё, что умеет `yt-dlp`): качаем сами.
  1. Есть субтитры автора → отдаём `CaptionsChunk` (самый быстрый и точный путь).
  2. Нет → качаем аудио, `ffmpeg` → 16 kHz mono → режем на `AudioChunk`.
- **live** (`blob:`-видео, закрытые сайты): звук шлёт расширение через WS (`ClientMessage "audio.chunk"`),
  этап просто перекладывает его в `AudioChunk` с правильным `range`.

## Важно

- `range` каждого куска — **абсолютное время в видео**, а не время от начала куска.
- Куски отдаём по порядку. При перемотке (`ClientMessage "playback"`) оркестратор может перезапустить этап с новым `startFrom`.
- Кэшировать по `platform + platformVideoId` — одно видео не качаем дважды.
