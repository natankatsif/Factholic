import assert from "node:assert/strict";
import { test } from "node:test";
import type { FactCheck, ProvenanceNode, ServerEvent, VideoReport } from "@news/contracts";
import { CabinetDb } from "./db.ts";
import { CabinetService, type JobRunner, type OrgError } from "./service.ts";
import type { OrgEvent, OrgSignal } from "./types.ts";

const SIGNALS: OrgSignal[] = [
  "new_publications",
  "growth",
  "new_language",
  "debunk_found",
  "sides_changed",
  "earlier_found",
  "quiet",
];

const node = (id: string, extra: Partial<ProvenanceNode> = {}): ProvenanceNode => ({
  id,
  name: id,
  category: "media",
  role: "retelling",
  date: "2026",
  quote: `цитата про пожар на складе ${id}`,
  isoDate: "2026-11-06",
  url: `https://site.md/${id}`,
  ...extra,
});

function factCheck(claim: string, ids: string[], extra: Partial<FactCheck> = {}): FactCheck {
  return {
    id: `fc_${claim}`,
    status: "done",
    range: { start: 0, end: 1 },
    quote: claim,
    claim,
    category: "event",
    consensus: "split",
    sides: { for: 1, against: 1, mixed: 0 },
    flags: [],
    sources: ids.map((id) => ({
      id,
      url: `https://site.md/${id}`,
      title: id,
      publisher: id,
      domain: "site.md",
      sourceType: "news",
      language: "ru",
      snippet: "",
      stance: "supports",
    })),
    provenance: {
      pathSummary: [],
      nodes: [
        node(ids[0]!, { isPrimary: true, role: "primary", isoDate: "2023-03-14" }),
        ...ids.slice(1).map((id) => node(id)),
      ],
      edges: [],
    },
    ...extra,
  };
}

/** Проверка без сети: отчёт задаёт тест */
class FakeRunner implements JobRunner {
  next: FactCheck[][] = [];
  reports = new Map<string, VideoReport>();
  listeners = new Map<string, (event: ServerEvent) => void>();
  started: Array<{ fresh: boolean }> = [];
  fail = false;

  start(_request: unknown, fresh: boolean): string {
    const id = `job_${this.started.length}`;
    this.started.push({ fresh });
    this.reports.set(id, {
      jobId: id,
      video: { pageUrl: "x", platform: "generic", title: "", durationSec: 0, language: "ru" },
      status: "processing",
      processedUntil: 0,
      factChecks: [],
    });
    return id;
  }
  report(id: string) {
    return this.reports.get(id);
  }
  subscribe(id: string, listener: (event: ServerEvent) => void) {
    this.listeners.set(id, listener);
    return () => undefined;
  }
  moreAccepted = true;
  more() {
    return this.moreAccepted;
  }
  finish(id: string, factChecks: FactCheck[]) {
    const report = { ...this.reports.get(id)!, status: "completed" as const, factChecks };
    this.reports.set(id, report);
    this.listeners.get(id)?.({ type: "job.completed", jobId: id, report });
  }
  failJob(id: string) {
    this.listeners.get(id)?.({
      type: "job.failed",
      jobId: id,
      error: { code: "INTERNAL", message: "нет" },
    });
  }
}

function setup(overrides: { checksPerMonth?: number; watches?: number } = {}) {
  const runner = new FakeRunner();
  const events: OrgEvent[] = [];
  let now = new Date("2026-11-05T10:00:00Z");
  const db = new CabinetDb(":memory:");
  const service = new CabinetService(db, runner, {
    organizationName: "Орг",
    memberName: "Ирина",
    checksPerMonth: overrides.checksPerMonth ?? 100,
    watches: overrides.watches ?? 20,
    now: () => now,
    emit: (event) => events.push(event),
  });
  return {
    service,
    runner,
    events,
    db,
    advance: (days: number) => (now = new Date(now.getTime() + days * 86_400_000)),
  };
}

function checked(ctx: ReturnType<typeof setup>, claim: string, ids: string[]) {
  const check = ctx.service.startCheck(claim);
  ctx.runner.finish(check.jobId, [factCheck(claim, ids)]);
  return ctx.service.listClaims("all").find((item) => item.text === claim)!;
}

test("проверка сохраняет утверждение и итог", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a", "b"]);
  assert.equal(claim.status, "new");
  assert.equal(claim.checksCount, 1);
  const detail = ctx.service.getCheck(claim.latestCheckId);
  assert.equal(detail.check.status, "done");
  assert.equal(detail.report?.factChecks.length, 1);
  assert.ok(detail.check.steps.every((step) => step.status === "done"));
  assert.ok(ctx.events.some((event) => event.type === "check.finished"));
});

test("текст без утверждений и упавшая проверка", () => {
  const ctx = setup();
  const empty = ctx.service.startCheck("Как всё надоело");
  ctx.runner.finish(empty.jobId, []);
  assert.equal(ctx.service.getCheck(empty.id).check.noClaims, true);
  assert.equal(ctx.service.listClaims("all").length, 0);

  const broken = ctx.service.startCheck("Текст");
  ctx.runner.failJob(broken.jobId);
  assert.equal(ctx.service.getCheck(broken.id).check.status, "failed");
  const retry = ctx.service.retryCheck(broken.id);
  assert.equal(retry.status, "running");
});

test("лимит проверок и слежений", () => {
  const ctx = setup({ checksPerMonth: 1, watches: 1 });
  const claim = checked(ctx, "Первое", ["a"]);
  assert.throws(
    () => ctx.service.startCheck("Второе"),
    (err: OrgError) => err.code === "CHECK_LIMIT",
  );
  ctx.service.createWatch({ claimId: claim.id, frequency: "daily", signals: SIGNALS, channels: ["cabinet"] });
  assert.equal(ctx.service.session().limits.watchesUsed, 1);
  const other = setup({ watches: 1 });
  const a = checked(other, "А", ["a"]);
  const b = checked(other, "Б", ["b"]);
  other.service.createWatch({ claimId: a.id, frequency: "daily", signals: SIGNALS, channels: ["cabinet"] });
  assert.throws(
    () =>
      other.service.createWatch({
        claimId: b.id,
        frequency: "daily",
        signals: SIGNALS,
        channels: ["cabinet"],
      }),
    (err: OrgError) => err.code === "WATCH_LIMIT",
  );
});

test("слежение: новые публикации дают уведомления и рост", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a", "b"]);
  const watch = ctx.service.createWatch({
    claimId: claim.id,
    frequency: "daily",
    signals: SIGNALS,
    channels: ["cabinet"],
  });
  ctx.advance(1);
  const check = ctx.service.checkWatchNow(watch.id);
  assert.equal(ctx.runner.started.at(-1)?.fresh, true);
  ctx.runner.finish(check.jobId, [factCheck("Сгорел ТЦ", ["a", "b", "c", "d", "e", "f", "g"])]);

  const types = ctx.service
    .alerts()
    .map((alert) => alert.type)
    .sort();
  assert.deepEqual(types, ["growth", "new_publications"]);
  const saved = ctx.service.listClaims("all")[0]!;
  assert.equal(saved.status, "spreading");
  assert.equal(saved.checksCount, 2);
  assert.equal(saved.latestCheckId, check.id);
  assert.equal(ctx.service.session().unreadAlerts, 2);
  assert.equal(ctx.service.listWatches()[0]?.fresh, 5);

  const alert = ctx.service.alerts()[0]!;
  ctx.service.readAlert(alert.id);
  assert.equal(ctx.service.session().unreadAlerts, 1);
  assert.equal(ctx.service.listWatches()[0]?.fresh, 0);
});

test("слежение: сигналы фильтруются и не повторяются в течение суток", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  const watch = ctx.service.createWatch({
    claimId: claim.id,
    frequency: "daily",
    signals: ["new_publications"],
    channels: ["cabinet"],
  });
  ctx.advance(1);
  const first = ctx.service.checkWatchNow(watch.id);
  ctx.runner.finish(first.jobId, [factCheck("Сгорел ТЦ", ["a", "b", "c", "d", "e", "f"])]);
  assert.deepEqual(
    ctx.service.alerts().map((alert) => alert.type),
    ["new_publications"],
  );
  const second = ctx.service.checkWatchNow(watch.id);
  ctx.runner.finish(second.jobId, [factCheck("Сгорел ТЦ", ["a", "b", "c", "d", "e", "f", "g"])]);
  assert.equal(ctx.service.alerts().length, 1);
});

test("слежение: разбор, смена итога, более ранняя публикация, затихание", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  const watch = ctx.service.createWatch({
    claimId: claim.id,
    frequency: "daily",
    signals: SIGNALS,
    channels: ["cabinet"],
  });
  ctx.advance(1);
  const next = factCheck("Сгорел ТЦ", ["a", "lab"], { consensus: "against" });
  next.provenance!.nodes[0]!.isoDate = "2020-01-01";
  next.provenance!.nodes[1] = node("lab", { category: "fact_checker" });
  const check = ctx.service.checkWatchNow(watch.id);
  ctx.runner.finish(check.jobId, [next]);
  const types = ctx.service.alerts().map((alert) => alert.type);
  for (const type of ["debunk_found", "sides_changed", "earlier_found"] as const)
    assert.ok(types.includes(type), type);
  assert.equal(ctx.service.listClaims("all")[0]?.status, "debunked");

  ctx.advance(15);
  const quiet = ctx.service.checkWatchNow(watch.id);
  ctx.runner.finish(quiet.jobId, [next]);
  assert.ok(ctx.service.alerts().some((alert) => alert.type === "quiet"));
});

test("плановый проход: только то, что пора, и выключает истёкшее", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  ctx.service.createWatch({
    claimId: claim.id,
    frequency: "weekly",
    signals: SIGNALS,
    days: 10,
    channels: ["cabinet"],
  });
  assert.equal(ctx.service.tick().length, 0);
  ctx.advance(8);
  assert.equal(ctx.service.tick().length, 1);
  ctx.advance(3);
  assert.equal(ctx.service.tick().length, 0);
  assert.equal(ctx.service.listWatches()[0]?.status, "finished");
});

test("пауза не даёт плановой проверки", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  const watch = ctx.service.createWatch({
    claimId: claim.id,
    frequency: "daily",
    signals: SIGNALS,
    channels: ["cabinet"],
  });
  ctx.service.updateWatch(watch.id, { status: "paused" });
  ctx.advance(2);
  assert.equal(ctx.service.tick().length, 0);
});

test("совет объединить: похожие утверждения, отказ и сборка нарратива", () => {
  const ctx = setup();
  const a = checked(ctx, "Сгорел ТЦ", ["a", "shared"]);
  const b = checked(ctx, "Скрывают пожар", ["b", "shared"]);
  checked(ctx, "Другая тема", ["z"]);
  const [suggestion] = ctx.service.session().suggestions;
  assert.ok(suggestion);
  assert.deepEqual([...suggestion.claimIds].sort(), [a.id, b.id].sort());
  assert.ok(suggestion.quotes.length > 0);
  assert.equal(suggestion.quotes[0]?.site, "shared");

  const narrative = ctx.service.createNarrative({
    title: "Скрывают масштаб",
    description: "Описание сотрудника",
    claimIds: suggestion.claimIds,
    suggestionId: suggestion.id,
  });
  assert.equal(ctx.service.session().suggestions.length, 0);
  assert.equal(ctx.service.listClaims("ungrouped").length, 1);
  const detail = ctx.service.getNarrative(narrative.id);
  assert.equal(detail.claims.length, 2);
  assert.ok(detail.narrative.quotes.every((quote) => quote.url));
  assert.equal(detail.narrative.confirmedBy, "Ирина");
});

test("отклонённый совет не возвращается", () => {
  const ctx = setup();
  checked(ctx, "Сгорел ТЦ", ["a", "shared"]);
  checked(ctx, "Скрывают пожар", ["b", "shared"]);
  const [suggestion] = ctx.service.session().suggestions;
  ctx.service.dismissSuggestion(suggestion!.id);
  checked(ctx, "Сгорел ТЦ", ["a", "shared"]);
  assert.equal(ctx.service.session().suggestions.length, 0);
});

test("данные переживают перезапуск, а незавершённая проверка становится ошибкой", () => {
  const ctx = setup();
  checked(ctx, "Сгорел ТЦ", ["a"]);
  const running = ctx.service.startCheck("Ещё текст");
  const restarted = new CabinetService(ctx.db, new FakeRunner(), {
    organizationName: "Орг",
    memberName: "Ирина",
    checksPerMonth: 100,
    watches: 20,
  });
  assert.equal(restarted.listClaims("all").length, 1);
  assert.equal(restarted.getCheck(running.id).check.status, "failed");
});

test("уточнение: вопрос ждёт ответа, проверка начинается только после него", async () => {
  const runner = new FakeRunner();
  const seen: string[] = [];
  const service = new CabinetService(new CabinetDb(":memory:"), runner, {
    organizationName: "Орг",
    memberName: "Ирина",
    checksPerMonth: 100,
    watches: 20,
    clarifier: async ({ text, locale }) => {
      seen.push(locale);
      return { needed: true, question: "Вы имеете в виду 2026 год?", rewritten: `${text} в 2026 году` };
    },
  });
  const first = await service.requestCheck("Объявили мобилизацию", "ro");
  assert.ok("clarification" in first);
  assert.equal(runner.started.length, 0);
  assert.deepEqual(seen, ["ro"]);
  assert.equal(service.session().clarifications.length, 1);

  const yes = service.answerClarification(first.clarification.id, "yes");
  assert.equal(yes.input, "Объявили мобилизацию в 2026 году");
  assert.equal(yes.locale, "ro");
  assert.equal(service.session().clarifications.length, 0);
  assert.throws(() => service.answerClarification(first.clarification.id, "yes"));

  const second = await service.requestCheck("Другой текст");
  assert.ok("clarification" in second);
  assert.equal(service.answerClarification(second.clarification.id, "no").input, "Другой текст");
  const third = await service.requestCheck("Третий текст");
  assert.ok("clarification" in third);
  assert.equal(
    service.answerClarification(third.clarification.id, "other", "Свой вариант").input,
    "Свой вариант",
  );
});

test("уточнение: без вопроса, при сбое и для ссылки проверка начинается сразу", async () => {
  const make = (clarifier: NonNullable<ConstructorParameters<typeof CabinetService>[2]["clarifier"]>) =>
    new CabinetService(new CabinetDb(":memory:"), new FakeRunner(), {
      organizationName: "Орг",
      memberName: "Ирина",
      checksPerMonth: 100,
      watches: 20,
      clarifier,
    });
  const quiet = make(async ({ text }) => ({ needed: false, question: "", rewritten: text }));
  assert.ok("check" in (await quiet.requestCheck("Текст в 2026 году")));
  const broken = make(async () => {
    throw new Error("сеть");
  });
  assert.ok("check" in (await broken.requestCheck("Текст")));
  const never = make(async () => {
    throw new Error("для ссылки вызываться не должен");
  });
  assert.ok("check" in (await never.requestCheck("https://example.org/a")));
});

test("уточнение: формулировка со смешанными алфавитами не показывается", async () => {
  const service = new CabinetService(new CabinetDb(":memory:"), new FakeRunner(), {
    organizationName: "Орг",
    memberName: "Ирина",
    checksPerMonth: 100,
    watches: 20,
    clarifier: async ({ text }) => ({ needed: true, question: "?", rewritten: `${text} в 2026 году` }),
  });
  assert.ok("check" in (await service.requestCheck("Dronele sunt ucrainene")));
});

test("утверждение сверх лимита не держит проверку в процессе", () => {
  const { service, runner } = setup();
  const check = service.startCheck("Текст");
  const skipped = factCheck("Второе", ["a"], { status: "found" });
  runner.finish(check.jobId, [factCheck("Первое", ["a"]), skipped]);
  assert.equal(service.getCheck(check.id).check.status, "done");
  assert.equal(service.getCheck(check.id).claims.length, 1);
});

test("проверка в работе не закрывается раньше времени", () => {
  const { service, runner } = setup();
  const check = service.startCheck("Текст");
  runner.finish(check.jobId, [factCheck("Первое", ["a"], { status: "checking" })]);
  assert.equal(service.getCheck(check.id).check.status, "running");
});

test("видео: свой список, в вопросы не попадает, готово после разбора", () => {
  const ctx = setup();
  const url = "https://www.youtube.com/watch?v=13R5R5nTcsk";
  const check = ctx.service.startCheck(url);
  assert.equal(check.kind, "video");
  assert.equal(ctx.service.session().counts.running, 1);
  assert.equal(ctx.service.session().running[0]?.kind, "video");

  // разобрано: первое проверено, второе дальше 45 секунд, его ждёт плеер. Ждать его не надо
  ctx.runner.finish(check.jobId, [
    factCheck("Первое", ["a"]),
    factCheck("Второе", [], { status: "found", range: { start: 60, end: 61 } }),
  ]);
  assert.equal(ctx.service.getCheck(check.id).check.status, "done");
  assert.equal(ctx.service.listClaims("all").length, 0);

  const [video] = ctx.service.listVideos();
  assert.equal(video?.claims, 2);
  assert.equal(video?.checked, 1);
  assert.equal(ctx.service.session().counts.videos, 1);

  // отчёт живой: утверждение, проверенное после разбора, видно сразу
  const report = ctx.runner.reports.get(check.jobId)!;
  ctx.runner.reports.set(check.jobId, {
    ...report,
    factChecks: report.factChecks.map((item) => ({ ...item, status: "done" as const })),
  });
  assert.equal(ctx.service.listVideos()[0]?.checked, 2);
  assert.equal(ctx.service.getCheck(check.id).report?.factChecks[1]?.status, "done");
});

test("видео: повторная ссылка открывает готовое и не тратит лимит", () => {
  const ctx = setup({ checksPerMonth: 1 });
  const first = ctx.service.startCheck("https://youtu.be/13R5R5nTcsk");
  const again = ctx.service.startCheck("https://www.youtube.com/watch?v=13R5R5nTcsk&t=5");
  assert.equal(again.id, first.id);
  assert.equal(ctx.runner.started.length, 1);
});

test("видео: пока начало не проверено, оно в процессе", () => {
  const ctx = setup();
  const check = ctx.service.startCheck("https://youtu.be/13R5R5nTcsk");
  ctx.runner.finish(check.jobId, [factCheck("Первое", ["a"], { status: "checking" })]);
  assert.equal(ctx.service.getCheck(check.id).check.status, "running");

  const report = ctx.runner.reports.get(check.jobId)!;
  const factCheckDone = { ...report.factChecks[0]!, status: "done" as const };
  ctx.runner.reports.set(check.jobId, { ...report, factChecks: [factCheckDone] });
  ctx.runner.listeners.get(check.jobId)?.({
    type: "job.completed",
    jobId: check.jobId,
    report: ctx.runner.reports.get(check.jobId)!,
  });
  assert.equal(ctx.service.getCheck(check.id).check.status, "done");
});

test("«Найти ещё» дополняет готовую проверку и считается в лимит", () => {
  const ctx = setup({ checksPerMonth: 2 });
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  const check = ctx.service.getCheck(claim.latestCheckId).check;
  const id = `fc_${claim.text}`;

  ctx.service.searchMore(check.id, id);
  assert.deepEqual(ctx.service.getCheck(check.id).searchingMore, [id]);
  assert.equal(ctx.service.session().limits.checksUsed, 2);

  const after = factCheck(claim.text, ["a", "b", "c"]);
  ctx.runner.reports.set(check.jobId, { ...ctx.runner.reports.get(check.jobId)!, factChecks: [after] });
  ctx.runner.listeners.get(check.jobId)?.({ type: "claim.checked", jobId: check.jobId, factCheck: after });

  const detail = ctx.service.getCheck(check.id);
  assert.deepEqual(detail.searchingMore, []);
  assert.equal(detail.check.status, "done");
  assert.equal(detail.check.lastMore?.found, 2);
  assert.equal(detail.report?.factChecks[0]?.provenance?.nodes.length, 3);
  assert.throws(
    () => ctx.service.searchMore(check.id, id),
    (err: OrgError) => err.code === "CHECK_LIMIT",
  );
});

test("«Найти ещё» не считается, если утверждение ещё проверяется", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  const check = ctx.service.getCheck(claim.latestCheckId).check;
  ctx.runner.moreAccepted = false;
  assert.throws(
    () => ctx.service.searchMore(check.id, `fc_${claim.text}`),
    (err: OrgError) => err.code === "BAD_REQUEST",
  );
  assert.deepEqual(ctx.service.getCheck(check.id).searchingMore, []);
  assert.equal(ctx.service.session().limits.checksUsed, 1);
});

test("вопрос убирается из нарратива, но остаётся в кабинете", () => {
  const ctx = setup();
  const a = checked(ctx, "Первое", ["a"]);
  const b = checked(ctx, "Второе", ["b"]);
  const narrative = ctx.service.createNarrative({
    title: "История",
    description: "",
    claimIds: [a.id, b.id],
  });

  const updated = ctx.service.removeFromNarrative(narrative.id, a.id);

  assert.deepEqual(updated.claimIds, [b.id]);
  assert.equal(ctx.service.getNarrative(narrative.id).claims.length, 1);
  const kept = ctx.service.listClaims("all").find((claim) => claim.id === a.id);
  assert.equal(kept?.narrativeId, undefined);
  assert.ok(ctx.service.listClaims("ungrouped").some((claim) => claim.id === a.id));
});

test("повторный поиск из списка идёт по последней проверке и виден в вопросе", () => {
  const ctx = setup();
  const claim = checked(ctx, "Сгорел ТЦ", ["a"]);
  ctx.service.repeatSearch(claim.id);
  assert.equal(ctx.service.listClaims("all")[0]?.searching, true);
  assert.deepEqual(ctx.service.getCheck(claim.latestCheckId).searchingMore, [claim.factCheckId]);

  const session = ctx.service.session();
  assert.equal(session.counts.running, 1);
  assert.equal(session.running[0]?.id, claim.latestCheckId);
  assert.equal(session.running[0]?.stepKey, "search");

  const jobId = ctx.service.getCheck(claim.latestCheckId).check.jobId;
  const event = { type: "claim.progress", jobId, claimId: claim.factCheckId, stage: "provenance" } as const;
  ctx.runner.listeners.get(jobId)?.(event);
  assert.equal(ctx.service.session().running[0]?.stepKey, "tree");

  const factCheckDone = factCheck(claim.text, ["a"]);
  ctx.runner.listeners.get(jobId)?.({ type: "claim.checked", jobId, factCheck: factCheckDone });
  assert.equal(ctx.service.session().counts.running, 0);
  assert.equal(ctx.service.listClaims("all")[0]?.checksCount, 2);
});
