"use client";

/** Экраны на настоящем API и обёртка демо-данных. Данные перечитываются по событиям /api/org/events */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionsContext, demoActions, type CabinetActions } from "./actions";
import { CabinetApiError, cabinetApi, subscribeCabinet } from "./api";
import { CheckScreen } from "./CheckScreen";
import { CabinetShell } from "./CabinetShell";
import { useCabinetText } from "./dictionary";
import { CheckSkeleton, HomeSkeleton, ListSkeleton } from "./Skeletons";
import type { CabinetFixture } from "./fixtures";
import { HomeScreen } from "./HomeScreen";
import {
  toCheckView,
  toHomeView,
  toNarrativeView,
  toQuestionRow,
  toRunningRow,
  toSession,
  toWatchRow,
} from "./live-map";
import { NarrativeScreen } from "./NarrativeScreen";
import { QuestionsScreen } from "./QuestionsScreen";
import type { ClaimScope, WatchDuration, WatchForm } from "./types";
import { WatchesScreen } from "./WatchesScreen";
import { DEFAULT_WATCH_FORM } from "./WatchSettings";

const DURATION_DAYS: Record<WatchDuration, number | undefined> = { d7: 7, d30: 30, forever: undefined };

const watchRequest = (claimId: string, form: WatchForm) => ({
  claimId,
  frequency: form.frequency,
  signals: form.signals,
  channels: form.channels,
  days: DURATION_DAYS[form.duration],
});

export function DemoProvider({ fixture, children }: { fixture: CabinetFixture; children: ReactNode }) {
  const router = useRouter();
  const picker = useMemo(
    () => fixture.questions.map((row) => ({ id: row.id, text: row.text })),
    [fixture.questions],
  );
  const actions = useMemo(() => demoActions(router.push, picker), [router, picker]);
  return <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>;
}

/** Общие данные кабинета и действия. load вызывается заново после каждого действия и события сервера */
function useLive<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [failed, setFailed] = useState<CabinetApiError | Error>();
  const loader = useRef(load);
  loader.current = load;
  const reload = useCallback(async () => {
    try {
      setData(await loader.current());
      setFailed(undefined);
    } catch (err) {
      setFailed(err as Error);
    }
  }, []);
  useEffect(() => {
    void reload();
    return subscribeCabinet(() => void reload());
  }, [reload]);
  return { data, failed, reload };
}

function useLiveActions(reload: () => Promise<void>, picker: CabinetActions["pickerClaims"]) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const t = useCabinetText();

  const actions = useMemo<CabinetActions>(() => {
    const run = async (task: () => Promise<unknown>) => {
      try {
        await task();
        setError(undefined);
      } catch (err) {
        const code = err instanceof CabinetApiError ? err.code : undefined;
        const known = code === "CHECK_LIMIT" || code === "WATCH_LIMIT" || code === "RATE_LIMITED";
        setError(known ? t.errors[code] : t.errors.generic);
      }
      await reload();
    };
    return {
      startCheck: (input) =>
        run(async () => {
          const started = await cabinetApi.startCheck(input, t.locale);
          // если модель спросила, вопрос появится в верхней панели
          if ("check" in started) router.push(`/cabinet/checks/${started.check.id}`);
        }),
      answerClarification: (id, answer, text) =>
        run(async () => {
          const check = await cabinetApi.answerClarification(id, answer, text);
          router.push(`/cabinet/checks/${check.id}`);
        }),
      retryCheck: (id) =>
        run(async () => {
          const check = await cabinetApi.retryCheck(id);
          router.push(`/cabinet/checks/${check.id}`);
        }),
      createWatch: (claimId, form) => run(() => cabinetApi.createWatch(watchRequest(claimId, form))),
      watchClaims: (claimIds) =>
        run(async () => {
          for (const claimId of claimIds)
            await cabinetApi.createWatch(watchRequest(claimId, DEFAULT_WATCH_FORM));
        }),
      setWatchStatus: (id, status) => run(() => cabinetApi.updateWatch(id, { status })),
      deleteWatch: (id) => run(() => cabinetApi.deleteWatch(id)),
      checkWatch: (id) => run(() => cabinetApi.checkWatch(id)),
      readAlert: (id) => run(() => cabinetApi.readAlert(id)),
      dismissSuggestion: (id) => run(() => cabinetApi.dismissSuggestion(id)),
      createNarrative: (input) =>
        run(async () => {
          const narrative = await cabinetApi.createNarrative(input);
          router.push(`/cabinet/narratives/${narrative.id}`);
        }),
      addToNarrative: (id, claimIds) => run(() => cabinetApi.addToNarrative(id, claimIds)),
      checkHref: (checkId) => `/cabinet/checks/${checkId}`,
      alertHref: (checkId) => `/cabinet/checks/${checkId}?alert=1`,
      pickerClaims: picker,
    };
  }, [picker, reload, router, t]);

  return { actions, error, clearError: () => setError(undefined) };
}

function ActionError({ text, onClose }: { text?: string; onClose: () => void }) {
  const t = useCabinetText();
  if (!text) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary py-2 pl-5 pr-2 text-[14px] font-extrabold text-white"
    >
      {text}
      <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-primary">
        {t.errors.close}
      </button>
    </div>
  );
}

async function loadCommon() {
  const [session, alerts, claims] = await Promise.all([
    cabinetApi.session(),
    cabinetApi.alerts(),
    cabinetApi.claims(),
  ]);
  return { session, alerts, claims };
}

function LiveFrame({
  reload,
  claims,
  children,
}: {
  reload: () => Promise<void>;
  claims?: Array<{ id: string; text: string }>;
  children: ReactNode;
}) {
  const picker = useMemo(() => claims ?? [], [claims]);
  const { actions, error, clearError } = useLiveActions(reload, picker);
  return (
    <ActionsContext.Provider value={actions}>
      {children}
      <ActionError text={error} onClose={clearError} />
    </ActionsContext.Provider>
  );
}

export function LiveHome({ noClaimsCheck }: { noClaimsCheck?: string }) {
  const t = useCabinetText();
  const { data, failed, reload } = useLive(async () => {
    const [common, empty] = await Promise.all([
      loadCommon(),
      noClaimsCheck ? cabinetApi.check(noClaimsCheck) : Promise.resolve(undefined),
    ]);
    return { ...common, noClaimsInput: empty?.check.input };
  });
  const view = data && {
    session: toSession(data.session, data.alerts, t),
    home: toHomeView(data.session, data.claims, t, data.noClaimsInput),
  };
  return (
    <LiveFrame reload={reload} claims={data?.claims}>
      {data || failed ? (
        <HomeScreen key={view ? `live-${view.home.state}` : "empty"} fixture={view} />
      ) : (
        <CabinetShell newCheck loading>
          <HomeSkeleton />
        </CabinetShell>
      )}
    </LiveFrame>
  );
}

export function LiveCheck({ id, showAlert }: { id: string; showAlert: boolean }) {
  const t = useCabinetText();
  const router = useRouter();
  const [claimIndex, setClaimIndex] = useState(0);
  const { data, failed, reload } = useLive(async () => {
    const [common, detail] = await Promise.all([loadCommon(), cabinetApi.check(id)]);
    return { ...common, detail };
  });
  const noClaims = data?.detail.check.noClaims;
  const missing = Boolean(failed) && !data;
  useEffect(() => {
    if (noClaims) router.replace(`/cabinet?noClaims=${id}`);
    else if (missing) router.replace("/cabinet");
  }, [noClaims, missing, id, router]);
  // пока неизвестно, есть ли в тексте утверждения, холст не показываем: дерева может и не быть
  const waitingClaims = data?.detail.check.status === "running" && !data.detail.report?.factChecks.length;
  if (!data || noClaims || waitingClaims) {
    return (
      <LiveFrame reload={reload}>
        <CabinetShell tree loading>
          <CheckSkeleton />
        </CabinetShell>
      </LiveFrame>
    );
  }
  const check = toCheckView(data.detail, claimIndex, t);
  return (
    <LiveFrame reload={reload} claims={data.claims}>
      <CheckScreen
        key={`${id}-${showAlert}`}
        fixture={{ session: toSession(data.session, data.alerts, t), overlay: {} }}
        check={check}
        onChooseClaim={setClaimIndex}
        initialFocusIds={showAlert ? (data.detail.alerts[0]?.nodeIds ?? []) : []}
      />
    </LiveFrame>
  );
}

export function LiveQuestions({ scope }: { scope: ClaimScope }) {
  const t = useCabinetText();
  const { data, failed, reload } = useLive(async () => {
    const [common, watches] = await Promise.all([loadCommon(), cabinetApi.watches()]);
    return { ...common, watches };
  });
  const view = data && {
    session: toSession(data.session, data.alerts, t),
    questions: [
      ...data.session.running.map((run) => toRunningRow(run, data.session, t)),
      ...data.claims.map((claim) =>
        toQuestionRow(
          claim,
          data.session,
          new Set(data.watches.filter((watch) => watch.status !== "finished").map((watch) => watch.claimId)),
          t,
        ),
      ),
    ],
  };
  return (
    <LiveFrame reload={reload} claims={data?.claims}>
      {data || failed ? (
        <QuestionsScreen fixture={view} scope={scope} />
      ) : (
        <CabinetShell pinnedMenu scope={scope} loading>
          <ListSkeleton />
        </CabinetShell>
      )}
    </LiveFrame>
  );
}

export function LiveWatches() {
  const t = useCabinetText();
  const { data, failed, reload } = useLive(async () => {
    const [common, watches] = await Promise.all([loadCommon(), cabinetApi.watches()]);
    return { ...common, watches };
  });
  const view = data && {
    session: toSession(data.session, data.alerts, t),
    watches: data.watches.map((watch) => toWatchRow(watch, t)),
  };
  return (
    <LiveFrame reload={reload} claims={data?.claims}>
      {data || failed ? (
        <WatchesScreen fixture={view} />
      ) : (
        <CabinetShell pinnedMenu scope="watched" loading>
          <ListSkeleton />
        </CabinetShell>
      )}
    </LiveFrame>
  );
}

export function LiveNarrative({ id }: { id: string }) {
  const t = useCabinetText();
  const router = useRouter();
  const { data, failed, reload } = useLive(async () => {
    const [common, detail] = await Promise.all([loadCommon(), cabinetApi.narrative(id)]);
    return { ...common, detail };
  });
  useEffect(() => {
    if (failed && !data) router.replace("/cabinet/questions");
  }, [failed, data, router]);
  if (!data) {
    return (
      <LiveFrame reload={reload}>
        <CabinetShell pinnedMenu narrativeId={id} loading>
          <ListSkeleton />
        </CabinetShell>
      </LiveFrame>
    );
  }
  return (
    <LiveFrame reload={reload} claims={data.claims}>
      <NarrativeScreen
        fixture={{
          session: toSession(data.session, data.alerts, t),
          narrative: toNarrativeView(data.detail, t),
        }}
      />
    </LiveFrame>
  );
}
