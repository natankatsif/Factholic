/**
 * Очередь проверок по требованию: утверждения найдены все, а проверяются (поиск + LLM — дорого) только нужные:
 *  1. открытые пользователем (request) — первыми, в порядке запросов;
 *  2. текущее в плеере и LOOKAHEAD следующих (playhead) — по порядку таймкодов;
 *  3. фон (background) — когда первым двум ничего не нужно (текст статьи: всё остальное, пока человек читает).
 * Перемотали — окно переезжает: то, что не успело начаться, возвращается в «найдено»; начатое доводится до конца.
 * Одновременно — не больше concurrency проверок, всего на материал — не больше maxChecks.
 * Чистая логика без внешних API: сама проверка — функция run (pipeline/checks.ts).
 */
import type { Seconds } from "@news/contracts";

/** Запас на неточность времени плеера: утверждение «наступило» чуть раньше его первой секунды */
const TIME_SLACK = 0.3;

export interface Schedulable {
  id: string;
  range: { start: Seconds };
}

export interface CheckSchedulerOptions<C extends Schedulable> {
  /** Проверить утверждение; не должна бросать (ошибка — FactCheck "failed") */
  run: (claim: C) => Promise<void>;
  /** Сколько проверок одновременно */
  concurrency: number;
  /** Сколько утверждений после текущего проверять заранее */
  lookahead: number;
  /** Потолок проверок на материал */
  maxChecks: number;
  /** Упёрлись в потолок — в лог */
  onLimit?: (claim: C) => void;
}

type State = "found" | "running" | "done";

export class CheckScheduler<C extends Schedulable> {
  private readonly opts: CheckSchedulerOptions<C>;
  /** По порядку таймкодов */
  private claims: C[] = [];
  private state = new Map<string, State>();
  /** Открытые пользователем, ещё не начатые — в порядке запросов */
  private requested: string[] = [];
  /** Фон: проверить, когда освободится место, — в порядке добавления */
  private queued: string[] = [];
  /** Позиция плеера; null — плеера нет или никто не смотрит */
  private position: Seconds | null = null;
  private running = 0;
  private started = 0;
  private idle: Array<() => void> = [];

  constructor(opts: CheckSchedulerOptions<C>) {
    this.opts = opts;
  }

  /** Новые найденные утверждения; done — уже проверенные (восстановление отчёта после перезапуска) */
  add(claims: C[], done: ReadonlySet<string> = new Set()): void {
    for (const c of claims) {
      if (this.state.has(c.id)) continue;
      this.claims.push(c);
      this.state.set(c.id, done.has(c.id) ? "done" : "found");
      if (done.has(c.id)) this.started++;
    }
    this.claims.sort((a, b) => a.range.start - b.range.start);
    this.pump();
  }

  /** Позиция плеера: проверяем текущее и LOOKAHEAD следующих */
  playhead(sec: Seconds | null): void {
    this.position = sec;
    this.pump();
  }

  /** Пользователь открыл утверждение. false — неизвестно, уже проверено или упёрлись в потолок */
  request(id: string): boolean {
    const st = this.state.get(id);
    if (st === undefined) return false;
    if (st !== "found") return true;
    if (this.started >= this.opts.maxChecks) {
      const claim = this.claims.find((c) => c.id === id);
      if (claim) this.opts.onLimit?.(claim);
      return false;
    }
    this.requested = [id, ...this.requested.filter((r) => r !== id)];
    this.pump();
    return true;
  }

  /** Проверка упала (поиск или LLM были недоступны) — вернуть в «найдено» и проверить заново, как открытое */
  retry(id: string): boolean {
    if (this.state.get(id) === "done") this.state.set(id, "found");
    return this.request(id);
  }

  /** В фон: проверить после запросов пользователя и окна плеера, в порядке добавления */
  background(ids: string[]): void {
    const fresh = ids.filter((id) => this.state.get(id) === "found" && !this.queued.includes(id));
    this.queued.push(...fresh);
    this.pump();
  }

  /** Никто не смотрит: ничего нового не начинаем (идущие проверки доводятся до конца) */
  clearQueue(): void {
    this.requested = [];
    this.queued = [];
    this.position = null;
  }

  status(id: string): State | undefined {
    return this.state.get(id);
  }

  /** Окно плеера: текущее утверждение и lookahead следующих; видео ещё не дошло до первого — первые lookahead + 1 */
  window(): C[] {
    if (this.position === null) return [];
    const t = this.position + TIME_SLACK;
    let current = 0;
    for (let i = 0; i < this.claims.length && this.claims[i].range.start <= t; i++) current = i;
    return this.claims.slice(current, current + this.opts.lookahead + 1);
  }

  /** Все начатые проверки закончились (для тестов и текста статьи) */
  whenIdle(): Promise<void> {
    if (this.running === 0) return Promise.resolve();
    return new Promise((resolve) => this.idle.push(resolve));
  }

  get checksStarted(): number {
    return this.started;
  }

  private next(): C | undefined {
    const byId = new Map(this.claims.map((c) => [c.id, c]));
    const order = [
      ...this.requested.map((id) => byId.get(id)),
      ...this.window(),
      ...this.queued.map((id) => byId.get(id)),
    ];
    return order.find((c): c is C => c !== undefined && this.state.get(c.id) === "found");
  }

  private pump(): void {
    while (this.running < this.opts.concurrency && this.started < this.opts.maxChecks) {
      const claim = this.next();
      if (!claim) break;
      this.state.set(claim.id, "running");
      this.requested = this.requested.filter((r) => r !== claim.id);
      this.queued = this.queued.filter((r) => r !== claim.id);
      this.running++;
      this.started++;
      void this.opts
        .run(claim)
        .catch(() => {})
        .finally(() => {
          this.state.set(claim.id, "done");
          this.running--;
          this.pump();
          if (this.running === 0) for (const resolve of this.idle.splice(0)) resolve();
        });
    }
  }
}
