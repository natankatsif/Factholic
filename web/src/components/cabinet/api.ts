/** Клиент API кабинета (/api/org/*). Типы общие с бэкендом, адрес — тот же, что у проверок на сайте */
import { BACKEND_URL } from "../../lib/jobs";
import type {
  Alert,
  ClaimCheck,
  ClarificationAnswer,
  CreateNarrativeRequest,
  CreateWatchRequest,
  Narrative,
  OrgApiError,
  OrgCheckDetail,
  OrgClaimScope,
  OrgEvent,
  OrgNarrativeDetail,
  OrgSession,
  StartCheckResponse,
  TrackedClaim,
  Watch,
} from "../../../../backend/src/org/types";

export class CabinetApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: OrgApiError["code"],
  ) {
    super(code ?? `HTTP ${status}`);
  }
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api/org${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as OrgApiError | null;
    throw new CabinetApiError(res.status, data?.code);
  }
  return (await res.json()) as T;
}

export type WatchWithClaim = Watch & { claim: TrackedClaim };

export const cabinetApi = {
  session: () => request<OrgSession>("/session"),
  claims: (scope: OrgClaimScope = "all") => request<TrackedClaim[]>(`/claims?scope=${scope}`),
  alerts: () => request<Alert[]>("/alerts"),
  check: (id: string) => request<OrgCheckDetail>(`/checks/${encodeURIComponent(id)}`),
  startCheck: (input: string, locale: string) =>
    request<StartCheckResponse>("/checks", "POST", { input, locale }),
  answerClarification: (id: string, answer: ClarificationAnswer, text?: string) =>
    request<ClaimCheck>(`/clarifications/${id}/answer`, "POST", { answer, text }),
  retryCheck: (id: string) => request<ClaimCheck>(`/checks/${id}/retry`, "POST"),
  watches: () => request<WatchWithClaim[]>("/watches"),
  createWatch: (body: CreateWatchRequest) => request<Watch>("/watches", "POST", body),
  updateWatch: (id: string, patch: Partial<Watch>) => request<Watch>(`/watches/${id}`, "PATCH", patch),
  deleteWatch: (id: string) => request<{ ok: true }>(`/watches/${id}`, "DELETE"),
  checkWatch: (id: string) => request<ClaimCheck>(`/watches/${id}/check`, "POST"),
  readAlert: (id: string) => request<Alert>(`/alerts/${id}/read`, "POST"),
  narrative: (id: string) => request<OrgNarrativeDetail>(`/narratives/${encodeURIComponent(id)}`),
  createNarrative: (body: CreateNarrativeRequest) => request<Narrative>("/narratives", "POST", body),
  addToNarrative: (id: string, claimIds: string[]) =>
    request<Narrative>(`/narratives/${id}`, "PATCH", { claimIds }),
  dismissSuggestion: (id: string) => request<{ ok: true }>(`/narrative-suggestions/${id}/dismiss`, "POST"),
};

/** Сокет событий кабинета. Возвращает отключение */
export function subscribeCabinet(onEvent: (event: OrgEvent) => void): () => void {
  const url = `${BACKEND_URL.replace(/^http/, "ws")}/api/org/events`;
  const socket = new WebSocket(url);
  socket.onmessage = (message) => onEvent(JSON.parse(String(message.data)) as OrgEvent);
  return () => socket.close();
}
