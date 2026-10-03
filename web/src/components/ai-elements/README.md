# AI Elements

Компоненты чата из [AI Elements](https://elements.ai-sdk.dev) (Vercel, для AI SDK), перенесённые в проект так,
как это делает их CLI (`npx ai-elements add …`): исходник лежит у нас и правится под дизайн.

Отличия от оригинала:

- нет shadcn: `Button` и `Collapsible` — минимальные свои в `components/ui/`, цвета shadcn (`bg-muted`,
  `text-muted-foreground`, `border-border`…) заданы палитрой сайта в `tailwind.config.ts`;
- `prompt-input` — только форма, поле и кнопка отправки (без вложений, меню и выбора модели);
- `message` — `MessageResponse` на streamdown без плагинов (код, формулы, mermaid в чате не нужны);
- `tool` — без JSON-блоков параметров: заголовок со статусом на русском и произвольное содержимое;
- `suggestion` — горизонтальная прокрутка обычным `overflow-x-auto` вместо ScrollArea.
