# 09 — Report: результат пайплайна → то, что видит фронт

**Владелец:** backend-2 (контракт согласуется с фронтом)

Превращает внутренние типы (`Claim`, `FoundSource`, `StancesOutput`, дерево и проверки на нём) в `FactCheck` —
единственную модель, которую знает расширение. Чистая функция без внешних API, не переключается mock/real.

|                 | Тип                                              | Файл                                                |
| --------------- | ------------------------------------------------ | --------------------------------------------------- |
| Вход            | `ReportInput` (`pending` / `checked` / `failed`) | `types.ts`                                          |
| Выход           | **`FactCheck`**                                  | `packages/contracts/src/fact-check.ts`              |
| Мок для дизайна | **`MOCK_VIDEO_REPORT`**                          | `packages/contracts/src/mocks/video-report.mock.ts` |

## Что уходит во фронт и когда

```
этап 03 нашёл тезис      → ServerEvent "claim.detected"  { factCheck: status "checking" }
этапы 05–08 закончили    → ServerEvent "claim.checked"   { factCheck: status "done", consensus, provenance, sources }
04 или 08 упали          → ServerEvent "claim.checked"   { factCheck: status "failed", error }
05 (дерево) упал         → status "done", provenance: null — стороны всё равно показываются
```

Фронт хранит `Map<id, FactCheck>` и просто заменяет объект по `id`.

## Что собирается

- `consensus` — из этапа 08 как есть.
- `provenance` — узлы дерева (05) без внутреннего поля `structure`, мутации (06), флаги: «старый контент» (07)
  и «раздули» — если среди мутаций есть `direction: "inflated"`.
- `verdict` — всегда `null` (старая концепция, поле `@deprecated`).

## Что отрезается

- `excerpt`, `domainReliability`, `queries`, `model`, `checkworthiness`, `segmentIds`, `structure` — внутреннее.
- Источники с `relevance < 0.3`.
