import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CheckScheduler } from "./scheduler.ts";

interface C {
  id: string;
  range: { start: number };
}
const claim = (id: string, start: number): C => ({ id, range: { start } });
/** Утверждения на 0, 60, 120, … секунде: c0, c1, c2, … */
const CLAIMS = Array.from({ length: 8 }, (_, i) => claim(`c${i}`, i * 60));

/** Проверки, которые завершаются вручную: release(id) */
function setup(opts: { concurrency?: number; maxChecks?: number } = {}) {
  const started: string[] = [];
  const pending = new Map<string, () => void>();
  const s = new CheckScheduler<C>({
    run: (c) =>
      new Promise<void>((resolve) => {
        started.push(c.id);
        pending.set(c.id, resolve);
      }),
    concurrency: opts.concurrency ?? 10,
    lookahead: 2,
    maxChecks: opts.maxChecks ?? 100,
  });
  const release = async (id: string) => {
    pending.get(id)?.();
    pending.delete(id);
    await new Promise((r) => setImmediate(r));
  };
  return { s, started, release };
}

describe("CheckScheduler", () => {
  it("без плеера и запросов ничего не проверяет — утверждения просто найдены", () => {
    const { s, started } = setup();
    s.add(CLAIMS);
    assert.deepEqual(started, []);
    assert.equal(s.status("c0"), "found");
  });

  it("плеер: текущее утверждение и два следующих", () => {
    const { s, started } = setup();
    s.add(CLAIMS);
    s.playhead(130); // текущее c2 (120 с)
    assert.deepEqual(started, ["c2", "c3", "c4"]);
  });

  it("видео ещё не дошло до первого — первые три", () => {
    const { s, started } = setup();
    s.add([claim("a", 50), claim("b", 70), claim("c", 90), claim("d", 300)]);
    s.playhead(0);
    assert.deepEqual(started, ["a", "b", "c"]);
  });

  it("утверждения пришли после позиции плеера — проверка начинается, как только они найдены", () => {
    const { s, started } = setup();
    s.playhead(0);
    s.add(CLAIMS.slice(0, 2));
    assert.deepEqual(started, ["c0", "c1"]);
    s.add(CLAIMS.slice(2));
    assert.deepEqual(started, ["c0", "c1", "c2"]);
  });

  it("перемотка: не начатое из старого окна не проверяется, окно — у новой позиции", async () => {
    const { s, started, release } = setup({ concurrency: 1 });
    s.add(CLAIMS);
    s.playhead(0); // c0 идёт, c1 и c2 ждут слота
    s.playhead(300); // перемотали к c5
    await release("c0");
    assert.deepEqual(started, ["c0", "c5"]);
    assert.equal(s.status("c1"), "found");
  });

  it("открытое пользователем — первым, раньше окна плеера", async () => {
    const { s, started, release } = setup({ concurrency: 1 });
    s.add(CLAIMS);
    s.playhead(0); // c0 идёт
    assert.equal(s.request("c7"), true);
    await release("c0");
    assert.deepEqual(started, ["c0", "c7"]);
  });

  it("повторный запрос и запрос уже проверенного не запускают проверку снова", async () => {
    const { s, started, release } = setup();
    s.add(CLAIMS);
    s.request("c3");
    s.request("c3");
    await release("c3");
    assert.equal(s.request("c3"), true);
    assert.deepEqual(started, ["c3"]);
    assert.equal(s.status("c3"), "done");
  });

  it("потолок проверок на материал: дальше запросы не принимаются", () => {
    const { s, started } = setup({ maxChecks: 2 });
    s.add(CLAIMS);
    s.request("c5");
    s.request("c6");
    assert.equal(s.request("c7"), false);
    assert.deepEqual(started, ["c5", "c6"]);
  });

  it("clearQueue: никто не смотрит — новые проверки не начинаются", async () => {
    const { s, started, release } = setup({ concurrency: 1 });
    s.add(CLAIMS);
    s.playhead(0);
    s.request("c6");
    s.clearQueue();
    await release("c0");
    assert.deepEqual(started, ["c0"]);
  });

  it("фон: проверяется, когда освободилось место; открытое пользователем — раньше фона", async () => {
    const { s, started, release } = setup({ concurrency: 1 });
    s.add(CLAIMS);
    s.request("c0");
    s.background(["c3", "c4"]);
    assert.deepEqual(started, ["c0"]);
    s.request("c7");
    await release("c0");
    assert.deepEqual(started, ["c0", "c7"]);
    await release("c7");
    await release("c3");
    assert.deepEqual(started, ["c0", "c7", "c3", "c4"]);
  });

  it("фон: clearQueue убирает и его", async () => {
    const { s, started, release } = setup({ concurrency: 1 });
    s.add(CLAIMS);
    s.request("c0");
    s.background(["c3"]);
    s.clearQueue();
    await release("c0");
    assert.deepEqual(started, ["c0"]);
  });

  it("восстановление: уже проверенные не проверяются снова и считаются в потолок", () => {
    const { s, started } = setup({ maxChecks: 3 });
    s.add(CLAIMS, new Set(["c0", "c1"]));
    s.playhead(0);
    assert.deepEqual(started, ["c2"]);
    assert.equal(s.status("c0"), "done");
  });
});
