# 06 — Delivery: результат пайплайна → то, что видит фронт

**Владелец:** backend-1 (контракт согласуется с фронтом)

Превращает внутренние типы (`Claim`, `FoundSource`, `VerificationOutput`) в `FactCheck` — единственную модель,
которую знает расширение — и отправляет её в WebSocket.

|                 | Тип                                                | Файл                                                |
| --------------- | -------------------------------------------------- | --------------------------------------------------- |
| Вход            | `DeliveryInput` (`pending` / `checked` / `failed`) | `types.ts`                                          |
| Выход           | **`FactCheck`**                                    | `packages/contracts/src/fact-check.ts`              |
| Мок для дизайна | **`MOCK_VIDEO_REPORT`**                            | `packages/contracts/src/mocks/video-report.mock.ts` |

## Что уходит во фронт и когда

```
этап 03 нашёл тезис   → ServerEvent "claim.detected"  { factCheck: status "checking" }
этап 05 закончил      → ServerEvent "claim.checked"   { factCheck: status "done", verdict, sources }
04/05 упали           → ServerEvent "claim.checked"   { factCheck: status "failed", error }
```

Фронт хранит `Map<id, FactCheck>` и просто заменяет объект по `id`.

## Что отрезается

- `excerpt`, `domainReliability`, `queries`, `model`, `checkworthiness`, `segmentIds` — внутреннее, во фронт не идёт.
- Источники с `relevance < 0.3`.
