# 02 — Transcription: звук → текст с таймкодами

**Владелец:** backend-1

Вызывается на **каждый** кусок из этапа 01. Возвращает предложения с абсолютными таймкодами видео.

|        | Тип                                                                       | Файл       |
| ------ | ------------------------------------------------------------------------- | ---------- |
| Вход   | `TranscriptionInput` (`MediaChunk` + `languageHint`)                      | `types.ts` |
| Выход  | `TranscriptionOutput` (`TranscriptSegment[]`)                             | `types.ts` |
| Пример | `mockTranscriptionInput`, `mockTranscriptionOutput`                       | `mock.ts`  |
| Mock   | `STAGE_TRANSCRIPTION=mock` → mock-функция в конце `mock.ts`               | `mock.ts`  |
| Real   | `STAGE_TRANSCRIPTION=real` в `.env`, нужны: `ASR_PROVIDER`, `ASR_API_KEY` | `real.ts`  |

## Требования

- Таймкоды — **абсолютные** (секунды от начала видео): ASR вернёт 21.0 для куска с `range.start = 1200` → пишем 1221.0.
- Сегмент = примерно одно предложение. Пунктуацию восстановить (для субтитров YouTube её нет).
- `words` очень желательны — по ним этап 03 вычисляет точный `range` тезиса (20:21–20:23, а не весь 30-секундный кусок).
- `speaker` — по возможности (диаризация), в UI показывается «кто сказал».
- Для `chunk.kind === "captions"` ASR не вызываем, только нормализуем текст.
