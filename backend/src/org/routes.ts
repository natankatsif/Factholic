/** HTTP и WebSocket кабинета: /api/org/*. Логика — в service.ts */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebSocket } from "ws";
import { config } from "../config.ts";
import { allow, clientIp } from "../pipeline/guard.ts";
import { createClarifier } from "./clarify.ts";
import { CabinetDb } from "./db.ts";
import { CabinetService, OrgError, type JobRunner } from "./service.ts";
import type {
  ClarificationAnswer,
  CreateNarrativeRequest,
  CreateWatchRequest,
  OrgClaimScope,
  OrgEvent,
  Watch,
} from "./types.ts";

const MAX_BODY = 64 * 1024;
const TICK_MS = 15 * 60 * 1000;
const SCOPES: OrgClaimScope[] = ["all", "mine", "watched", "running", "ungrouped"];
const EVENTS_PATH = "/api/org/events";

function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk;
      if (data.length > MAX_BODY) reject(new OrgError(413, "BAD_REQUEST", "запрос слишком большой"));
    });
    req.on("end", () => {
      try {
        resolve((data ? JSON.parse(data) : {}) as T);
      } catch {
        reject(new OrgError(400, "BAD_REQUEST", "неверный JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function createOrgApi(runner: JobRunner) {
  const listeners = new Set<WebSocket>();
  const broadcast = (event: OrgEvent) => {
    const text = JSON.stringify(event);
    for (const ws of listeners) if (ws.readyState === ws.OPEN) ws.send(text);
  };
  const service = new CabinetService(new CabinetDb(config.cabinet.dbPath), runner, {
    organizationName: config.cabinet.organizationName,
    memberName: config.cabinet.memberName,
    checksPerMonth: config.cabinet.checksPerMonth,
    watches: config.cabinet.watches,
    // на моках модели нет: проверка идёт сразу
    clarifier: config.stages.claimExtraction === "real" ? createClarifier() : undefined,
    emit: broadcast,
  });

  if (config.cabinet.scheduler) {
    setInterval(() => {
      try {
        service.tick();
      } catch (err) {
        console.error("cabinet: плановое слежение упало", err);
      }
    }, TICK_MS).unref();
  }

  const guard = (req: IncomingMessage) => {
    const denied = allow("job", clientIp(req));
    if (denied) throw new OrgError(429, "RATE_LIMITED", denied);
  };

  async function route(req: IncomingMessage, res: ServerResponse, path: string, query: URLSearchParams) {
    const method = req.method ?? "GET";
    const part = path.split("/").filter(Boolean).slice(2).map(decodeURIComponent);
    const [area, id, action] = part;

    if (method === "GET" && area === "session") return send(res, 200, service.session());

    if (area === "checks") {
      if (method === "POST" && !id) {
        const { input, locale } = await readJson<{ input: string; locale?: string }>(req);
        guard(req);
        return send(res, 201, await service.requestCheck(input, locale));
      }
      if (method === "GET" && id) return send(res, 200, service.getCheck(id));
      if (method === "POST" && id && action === "retry") {
        guard(req);
        return send(res, 201, service.retryCheck(id));
      }
    }

    if (area === "clarifications" && method === "POST" && id && action === "answer") {
      const { answer, text } = await readJson<{ answer: ClarificationAnswer; text?: string }>(req);
      guard(req);
      return send(res, 201, service.answerClarification(id, answer, text));
    }

    if (area === "claims" && method === "GET") {
      const scope = SCOPES.find((item) => item === query.get("scope")) ?? "all";
      return send(res, 200, service.listClaims(scope));
    }

    if (area === "watches") {
      if (method === "GET" && !id) return send(res, 200, service.listWatches());
      if (method === "POST" && !id) {
        return send(res, 201, service.createWatch(await readJson<CreateWatchRequest>(req)));
      }
      if (method === "PATCH" && id)
        return send(res, 200, service.updateWatch(id, await readJson<Partial<Watch>>(req)));
      if (method === "DELETE" && id) {
        service.deleteWatch(id);
        return send(res, 200, { ok: true });
      }
      if (method === "POST" && id && action === "check") {
        guard(req);
        return send(res, 201, service.checkWatchNow(id));
      }
    }

    if (area === "alerts") {
      if (method === "GET" && !id) return send(res, 200, service.alerts());
      if (method === "POST" && id && action === "read") return send(res, 200, service.readAlert(id));
    }

    if (area === "narratives") {
      if (method === "GET" && !id) return send(res, 200, service.listNarratives());
      if (method === "GET" && id) return send(res, 200, service.getNarrative(id));
      if (method === "POST" && !id) {
        return send(res, 201, service.createNarrative(await readJson<CreateNarrativeRequest>(req)));
      }
      if (method === "PATCH" && id) {
        const { claimIds } = await readJson<{ claimIds: string[] }>(req);
        return send(res, 200, service.addToNarrative(id, claimIds ?? []));
      }
    }

    if (area === "narrative-suggestions" && method === "POST" && id && action === "dismiss") {
      service.dismissSuggestion(id);
      return send(res, 200, { ok: true });
    }

    throw new OrgError(404, "NOT_FOUND", "нет такого адреса");
  }

  return {
    service,
    isEventsUrl: (url?: string) => url === EVENTS_PATH,
    addListener(ws: WebSocket) {
      listeners.add(ws);
      ws.on("close", () => listeners.delete(ws));
    },
    /** true — запрос был к кабинету и ответ отправлен */
    async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
      const url = new URL(req.url ?? "/", "http://local");
      if (!url.pathname.startsWith("/api/org/")) return false;
      try {
        await route(req, res, url.pathname, url.searchParams);
      } catch (err) {
        if (err instanceof OrgError) send(res, err.status, { error: err.message, code: err.code });
        else {
          console.error("cabinet: запрос упал", err);
          send(res, 500, { error: "внутренняя ошибка" });
        }
      }
      return true;
    },
  };
}
