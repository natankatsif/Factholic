import assert from "node:assert/strict";
import { test } from "node:test";
import type { StartAnalysisRequest } from "@news/contracts";
import { JobStore } from "./store.ts";

const request: StartAnalysisRequest = {
  video: { pageUrl: "text://cabinet", platform: "generic" },
  mode: "remote",
  startFrom: 0,
  uiLanguage: "ru",
  text: `Текст для проверки кэша ${Date.now()}`,
};

test("удалённая задача не отдаётся из кэша по тому же тексту", () => {
  const store = new JobStore();
  const { job } = store.create("job_a", request);
  assert.equal(store.create("job_b", request).job.id, "job_a");

  store.purge(job);

  assert.equal(store.get("job_a"), undefined);
  assert.equal(job.abort.signal.aborted, true);
  assert.equal(store.create("job_c", request).job.id, "job_c");
});

test("если разбор ещё нужен, задача остаётся, но повторно не отдаётся", () => {
  const store = new JobStore();
  const text = { ...request, text: `${request.text} второй` };
  const { job } = store.create("job_d", text);
  store.purge(job, true);
  assert.equal(store.get("job_d")?.id, "job_d");
  assert.equal(job.abort.signal.aborted, false);
  assert.equal(store.create("job_e", text).job.id, "job_e");
});
