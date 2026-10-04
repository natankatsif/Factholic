/**
 * Защита от спама и перерасхода (OpenAI/Tavily платные за каждый запрос):
 *  - лимит на одного человека (IP) за час: новые проверки, вопросы в чат;
 *  - общий суточный бюджет на весь сервер: новые материалы, проверки утверждений, вопросы в чат.
 * Готовое из кэша ничего не стоит — не считаем. Счётчики в памяти процесса: после перезапуска обнуляются.
 * Чистая логика без внешних API.
 */
import type { IncomingMessage } from "node:http";
import { config } from "../config.ts";

const HOUR_MS = 60 * 60 * 1000;

/** Скользящее окно: не больше limit событий за windowMs на ключ (IP) */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = HOUR_MS,
  ) {}

  /** true — можно (событие засчитано); false — лимит исчерпан */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // старые ключи не копим: раз в ~1000 записей чистим пустые
    if (this.hits.size > 1000 && Math.random() < 0.01) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits) {
      if (!times.some((t) => now - t < this.windowMs)) this.hits.delete(key);
    }
  }
}

/** Суточный бюджет на весь сервер (по UTC): не больше limit событий за день */
export class DailyBudget {
  private day = "";
  private used = 0;

  constructor(private readonly limit: number) {}

  take(now = Date.now()): boolean {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }
}

export type GuardedAction = "job" | "check" | "chat";

const perIp: Record<GuardedAction, RateLimiter> = {
  job: new RateLimiter(config.abuse.jobsPerIpPerHour),
  check: new RateLimiter(config.abuse.checksPerIpPerHour),
  chat: new RateLimiter(config.abuse.chatPerIpPerHour),
};
const daily: Record<GuardedAction, DailyBudget> = {
  job: new DailyBudget(config.abuse.dailyJobs),
  check: new DailyBudget(config.abuse.dailyChecks),
  chat: new DailyBudget(config.abuse.dailyChat),
};

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Можно ли потратить деньги на действие. null — можно (засчитано), иначе — текст для пользователя.
 * ip undefined (неизвестен) или localhost без прокси — только суточный бюджет.
 */
export function allow(action: GuardedAction, ip: string | undefined): string | null {
  if (ip && !LOOPBACK.has(ip) && !perIp[action].take(ip)) return LIMIT_TEXT[action].perIp;
  if (!daily[action].take()) return LIMIT_TEXT[action].daily;
  return null;
}

const LIMIT_TEXT: Record<GuardedAction, { perIp: string; daily: string }> = {
  job: {
    perIp: "Слишком много проверок подряд. Подожди немного и попробуй снова",
    daily: "Сервис сегодня исчерпал дневной лимит проверок. Попробуй завтра",
  },
  check: {
    perIp: "Слишком много проверок подряд — это утверждение проверим чуть позже",
    daily: "Дневной лимит проверок исчерпан — попробуй завтра",
  },
  chat: {
    perIp: "Слишком много вопросов подряд. Подожди немного и спроси снова",
    daily: "Ассистент сегодня исчерпал дневной лимит. Попробуй завтра",
  },
};

/**
 * IP посетителя. За туннелем Cloudflare и на Vercel сокет — всегда прокси, настоящий адрес — в заголовках.
 * Первым — заголовки, которые ставит сама платформа и клиент подделать не может.
 */
export function clientIp(req: IncomingMessage): string {
  const header = (name: string) => {
    const v = req.headers[name];
    return (Array.isArray(v) ? v[0] : v)?.split(",")[0]?.trim() || undefined;
  };
  return (
    header("cf-connecting-ip") ??
    header("x-vercel-forwarded-for") ??
    header("x-real-ip") ??
    header("x-forwarded-for") ??
    req.socket.remoteAddress ??
    "unknown"
  );
}
