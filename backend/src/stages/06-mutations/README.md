# 06 — Mutations: дерево → где утверждение раздули

**Владелец:** backend-2

Сравнивает структуру утверждения у родителя и потомка вдоль рёбер дерева и находит, что изменилось при перепечатке.

|        | Тип                                                                                            | Файл       |
| ------ | ---------------------------------------------------------------------------------------------- | ---------- |
| Вход   | `MutationsInput` (`Claim` + дерево из 05)                                                      | `types.ts` |
| Выход  | `MutationsOutput` (`ClaimMutation[]` из contracts)                                             | `types.ts` |
| Пример | `mockMutationsInput`, `mockMutationsOutput`; пример с раздутыми цифрами — `clm_09` в contracts | `mock.ts`  |
| Mock   | `STAGE_MUTATIONS=mock`                                                                         | `mock.ts`  |
| Real   | `STAGE_MUTATIONS=real`, нужны: `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`                      | `real.ts`  |

## Что делать

1. Пары: каждое ребро дерева (`parentId → id`), где у обоих есть `structure`, плюс корень → `"video"`.
2. Дешёвый предфильтр кодом: если числа, места, маркеры времени и уверенность совпадают — пара в LLM не идёт.
3. Остальные пары — одним вызовом LLM: изменения по полям `numbers` / `place` / `time` / `certainty` /
   `attribution`, `direction` (`inflated` — раздули: число выросло, «возможно» стало «точно»; `deflated`;
   `changed`) и короткий `note` на `uiLanguage`.

Этап 09 ставит флаг «раздули», если есть хотя бы одна мутация с `direction: "inflated"`.
