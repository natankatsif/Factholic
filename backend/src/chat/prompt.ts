/**
 * Инструкции ассистента и контекст разбора: модель отвечает по отчёту, а чего в нём нет — ищет в интернете.
 * Принципы продукта (AGENTS.md, раздел 2) — те же: только по найденным публикациям, нейтральный тон, без вердиктов.
 */
import type { FactCheck, VideoReport } from "@news/contracts";

const MAX_CONTEXT_CHARS = 14_000;

export function buildInstructions(report: VideoReport, claimId: string | undefined, today: string): string {
  const claim = report.factChecks.find((f) => f.id === claimId) ?? report.factChecks[0];
  const others = report.factChecks.filter((f) => f !== claim).map((f) => `- ${f.claim}`);

  return `Ты — ассистент factholic. Пользователь смотрит разбор утверждения и задаёт вопросы.
Сегодня ${today}.

Как отвечать:
- По-русски, коротко: 2–6 предложений или короткий список. Markdown можно, заголовки — нет.
- Сначала опирайся на разбор ниже: первоисточник, путь утверждения, что изменилось при пересказах, позиции источников.
- Если ответ есть в разборе — отвечай сразу, без поиска: каждый поиск — несколько секунд ожидания.
- Если в разборе ответа нет, пользователь просит уточнить, проверить свежие новости или найти что-то ещё — вызови
  webSearch один раз, точным запросом на самом подходящем языке (ro/ru/en). Второй поиск — только если первый
  ничего не дал. Не выдумывай факты, даты и ссылки.
- Каждый факт из поиска или разбора подкрепляй ссылкой в markdown: [издание](url). Указывай дату публикации, если она есть.
- Не выносишь вердикт «правда/ложь». Рассказываешь историю утверждения: кто первым написал, как менялось, кто согласен.
- Если источников мало или они противоречат друг другу — так и скажи.
- Нейтральный тон: без оценочных эпитетов и политической позиции, не повторяй оскорбления.

Материал: ${report.video.title || "без названия"}${report.video.publishedAt ? `, опубликован ${report.video.publishedAt}` : ""}

Разбор выбранного утверждения (JSON):
${JSON.stringify(claimContext(claim)).slice(0, MAX_CONTEXT_CHARS)}
${others.length ? `\nДругие утверждения из того же материала:\n${others.join("\n")}` : ""}`;
}

/** Только то, что нужно модели: без раскладки дерева, иконок и id */
function claimContext(fc: FactCheck | undefined) {
  if (!fc) return null;
  const tree = fc.provenance;
  return {
    quote: fc.quote,
    claim: fc.claim,
    status: fc.status,
    consensus: fc.consensus,
    consensusSummary: fc.consensusSummary,
    keyFinding: fc.keyFinding,
    flags: fc.flags.map((f) => `${f.label}: ${f.detail}`),
    sources: fc.sources.map((s) => ({
      publisher: s.publisher,
      title: s.title,
      url: s.url,
      publishedAt: s.publishedAt,
      stance: s.stance,
      snippet: s.snippet.slice(0, 300),
    })),
    path: tree?.pathSummary?.map((p) => `${p.name} (${p.date}) — ${p.tag}`),
    publications: tree?.nodes
      .filter((n) => n.role !== "target")
      .map((n) => ({ name: n.name, date: n.date, role: n.role, url: n.url })),
    changes: tree?.edges
      .filter((e) => e.diff?.changes.length)
      .map((e) => ({
        from: tree.nodes.find((n) => n.id === e.fromNodeId)?.name,
        to: tree.nodes.find((n) => n.id === e.toNodeId)?.name,
        changes: e.diff!.changes.map((c) => `${c.categoryLabel}: ${c.description}`),
      })),
  };
}
