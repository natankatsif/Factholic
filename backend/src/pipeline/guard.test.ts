import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { test } from "node:test";
import { DailyBudget, RateLimiter, clientIp } from "./guard.ts";

test("RateLimiter: не больше limit за окно, у каждого IP — своё окно", () => {
  const limiter = new RateLimiter(2, 1000);
  assert.equal(limiter.take("a", 0), true);
  assert.equal(limiter.take("a", 10), true);
  assert.equal(limiter.take("a", 20), false);
  assert.equal(limiter.take("b", 20), true);
  // окно прошло — снова можно
  assert.equal(limiter.take("a", 1001), true);
});

test("DailyBudget: потолок на сутки, с новым днём — заново", () => {
  const budget = new DailyBudget(1);
  const day1 = Date.UTC(2026, 9, 4, 10);
  assert.equal(budget.take(day1), true);
  assert.equal(budget.take(day1 + 1000), false);
  assert.equal(budget.take(Date.UTC(2026, 9, 5, 0, 1)), true);
});

test("clientIp: заголовок Cloudflare важнее X-Forwarded-For и сокета", () => {
  const req = (headers: Record<string, string>) =>
    ({ headers, socket: { remoteAddress: "127.0.0.1" } }) as unknown as IncomingMessage;
  assert.equal(clientIp(req({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })), "1.1.1.1");
  assert.equal(clientIp(req({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" })), "3.3.3.3");
  assert.equal(clientIp(req({})), "127.0.0.1");
});
