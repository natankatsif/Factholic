"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { isPendingCheck, type FactCheck, type ServerEvent, type VideoReport } from "@news/contracts";
import { ProgressScreen, VerificationScreen, type VerificationView } from "../../../components/verification";
import type { ProgressKind } from "../../../components/verification/ProgressScreen";
import { materialKind } from "../../../components/verification/material";
import { deleteJob, listJobs, subscribeJob, type JobSubscription } from "../../../lib/jobs";
import { markCrowdSay } from "../../../lib/history-ui";
import { getNonFactualMessage } from "../../../lib/claim-precheck";
import { detectPlatform } from "../../../lib/platform-detector";
import { reportYoutubeId } from "../../../lib/youtube";

/** Минимальное время шага, над которым бэкенд правда работает: персонаж успевает сменить эмоцию */
const MIN_STAGE_DURATION_MS = 4000;
/** Шаг был готов ещё до того, как до него дошла очередь (отчёт из кэша, у видео нечего проверять заранее) */
const MIN_DONE_STAGE_MS = 900;

/** Сколько обычно длится этап, мс: по этому растёт полоса, пока бэкенд не сообщил реальный ход */
const EXPECTED_STAGE_MS = [6000, 12000, 15000, 15000];
/** Без подтверждения бэкенда полоса не заходит дальше — 100% только когда этап на бэкенде правда готов */
const MAX_UNCONFIRMED = 0.92;
const STAGE_NAMES = ["Текст", "Утверждения", "Источники", "Дерево"];

/** Дольше — уже длинное видео (как на бэкенде, ClaimChecker): короче — шортс / рилс */
const SHORTS_MAX_SEC = 90;
/**
 * Длинное видео: первое утверждение дальше этой секунды — разбор открываем сразу, проверки успеют, пока
 * смотрят начало. Совпадает с длиной куска на бэкенде, поэтому ответ известен после первого куска.
 */
const EARLY_WINDOW_SEC = 30;
/** «Первая часть»: столько утверждений проверяется до открытия разбора — одна волна проверок на бэкенде */
const FIRST_PART_CLAIMS = 3;
/** Проверки первой части так и не закончились (сбой, потолок) — дольше этого загрузку не держим */
const CHECKS_TIMEOUT_MS = 90_000;

/**
 * Как открывается разбор:
 *  long   — длинное видео YouTube: проверки идут по ходу просмотра, заранее — только утверждения первых 30 с;
 *  shorts — шортс: видео кончится раньше проверок, поэтому заранее — все;
 *  text   — текст, статья и видео без плеера: заранее — первая часть, остальное догружается в разборе.
 */
type Flow = "long" | "shorts" | "text";

function flowOf(report: VideoReport): Flow {
  if (materialKind(report.video) !== "video") return "text";
  if (report.video.durationSec > 0 && report.video.durationSec <= SHORTS_MAX_SEC) return "shorts";
  return reportYoutubeId(report.video) ? "long" : "text";
}

/** Что известно о ходе проверки сверх снапшота отчёта */
interface Tracking {
  /** До какой секунды материал разобран на утверждения подряд, без дыр (job.progress claim_extraction) */
  extractedUntil: number;
  /** Когда стала известна первая часть — от этого считается CHECKS_TIMEOUT_MS */
  knownAt: number | null;
}

/** Утверждения, которые проверяем до открытия разбора */
interface FirstPart {
  /** Разбор на утверждения дошёл до места, где первая часть известна */
  known: boolean;
  claims: FactCheck[];
  /** Сколько из claims должно быть проверено (у текста — любые need: бэкенд берёт самые важные) */
  need: number;
}

function firstPart(report: VideoReport, t: Tracking): FirstPart {
  const all = report.factChecks;
  const completed = report.status === "completed";
  switch (flowOf(report)) {
    case "shorts":
      return { known: completed, claims: all, need: all.length };
    case "long": {
      // бэкенд проверяет текущее в плеере и два следующих — с начала видео это первые три
      const early = all
        .filter((fc) => fc.range.start < EARLY_WINDOW_SEC)
        .sort((a, b) => a.range.start - b.range.start)
        .slice(0, FIRST_PART_CLAIMS);
      return { known: completed || t.extractedUntil >= EARLY_WINDOW_SEC, claims: early, need: early.length };
    }
    case "text":
      return { known: completed, claims: all, need: Math.min(FIRST_PART_CLAIMS, all.length) };
  }
}

const pastSearch = (fc: FactCheck) =>
  !isPendingCheck(fc) || fc.stage === "provenance" || fc.stage === "stances";
const finished = (fc: FactCheck) => !isPendingCheck(fc);

/**
 * Сколько шагов загрузки бэкенд уже прошёл (0–4):
 *  0 Текст / Статья / Субтитры — текст получен (первый job.progress);
 *  1 Утверждения — найдены утверждения первой части;
 *  2 Источники — у первой части закончился поиск;
 *  3 Дерево — первая часть проверена целиком → 4, разбор можно открывать.
 */
function backendStage(report: VideoReport | null, t: Tracking, now: number): number {
  if (!report || report.status === "queued") return 0;
  const completed = report.status === "completed";
  if (!completed && (report.stage === undefined || report.stage === "ingest")) return 0;
  const part = firstPart(report, t);
  if (!part.known) return 1;
  if (t.knownAt !== null && now - t.knownAt > CHECKS_TIMEOUT_MS) return 4;
  if (part.claims.filter(pastSearch).length < part.need) return 2;
  if (part.claims.filter(finished).length < part.need) return 3;
  return 4;
}

/**
 * Сколько процентов шага на самом деле готово: по данным бэкенда, где они есть, иначе — оценка по времени.
 */
function stageTarget(
  report: VideoReport | null,
  t: Tracking,
  stage: number,
  elapsedMs: number,
  now: number,
): { target: number; done: boolean; why: string } {
  const done = backendStage(report, t, now) > stage;
  if (done) return { target: 1, done, why: "бэкенд закончил этап" };

  let real: number | null = null;
  let why = "";
  if (report && report.status !== "queued") {
    const flow = flowOf(report);
    const part = firstPart(report, t);
    if (stage === 0 && report.video.durationSec) {
      // длинному видео для начала нужен только первый кусок
      const need = flow === "long" ? EARLY_WINDOW_SEC : report.video.durationSec;
      real = Math.min(1, report.processedUntil / need);
      why = `расшифровано ${Math.round(report.processedUntil)} из ${Math.round(need)} с`;
    } else if (stage === 1 && flow === "long") {
      real = Math.min(1, t.extractedUntil / EARLY_WINDOW_SEC);
      why = `разобрано ${Math.round(t.extractedUntil)} из ${EARLY_WINDOW_SEC} с`;
    } else if (stage === 2 && part.need) {
      const n = part.claims.filter(pastSearch).length;
      real = Math.min(1, n / part.need);
      why = `поиск прошли ${n} из ${part.need} утверждений первой части`;
    } else if (stage === 3 && part.need) {
      const n = part.claims.filter(finished).length;
      real = Math.min(1, n / part.need);
      why = `проверено ${n} из ${part.need} утверждений первой части`;
    }
  }
  // оценка по времени: быстро в начале, дальше всё медленнее, к MAX_UNCONFIRMED не подходит вплотную
  const byTime = MAX_UNCONFIRMED * (1 - Math.exp(-elapsedMs / EXPECTED_STAGE_MS[stage]));
  const target = Math.min(MAX_UNCONFIRMED, Math.max(real ?? 0, byTime));
  return { target, done, why: why || `оценка по времени (${(elapsedMs / 1000).toFixed(0)} с)` };
}

/** Событие сдвинуло границу разобранного на утверждения */
function trackEvent(t: Tracking, report: VideoReport, event: ServerEvent | undefined, now: number): void {
  if (event?.type === "job.progress" && event.stage !== "transcription")
    t.extractedUntil = Math.max(t.extractedUntil, event.processedUntil);
  if (report.status === "completed") t.extractedUntil = Infinity;
  if (t.knownAt === null && report.status !== "queued" && firstPart(report, t).known) t.knownAt = now;
}

/** Лог хода проверки в консоль браузера */
function logProgress(jobId: string, stage: number, percent: number, why: string) {
  console.log(
    `%c[проверка ${jobId.slice(0, 8)}]%c ${STAGE_NAMES[stage] ?? "Готово"} ${percent}% — ${why}`,
    "color:#0AA6C2;font-weight:bold",
    "color:inherit",
  );
}

/** Пустой фон страницы — пока не знаем, готова проверка или ещё идёт */
function BlankScreen() {
  return <div className="min-h-[100svh] bg-[#F1EBE9]" />;
}

/** Страница одной проверки: /check/<jobId>. Дерево источников — /check/<jobId>?view=tree */
function CheckPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: VerificationView = searchParams.get("view") === "tree" ? "tree" : "analysis";

  // Если проверка открыта из истории и уже завершена — сразу восстанавливаем отчёт без перезапуска этапов
  const cachedJob = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return listJobs().find((j) => j.jobId === jobId) ?? null;
    } catch {
      return null;
    }
  }, [jobId]);

  const isAlreadyCompleted = cachedJob?.report?.status === "completed";

  const [report, setReport] = useState<VideoReport | null>(() => cachedJob?.report ?? null);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<number>(isAlreadyCompleted ? 4 : 0);
  const [stageProgress, setStageProgress] = useState<number>(isAlreadyCompleted ? 1 : 0);
  const [isPacingDone, setIsPacingDone] = useState<boolean>(Boolean(isAlreadyCompleted));

  // При переходе между задачами (например, клик по истории в шапке) синхронизируем состояние
  const prevJobIdRef = useRef(jobId);
  if (prevJobIdRef.current !== jobId) {
    prevJobIdRef.current = jobId;
    setReport(cachedJob?.report ?? null);
    setError(null);
    setCurrentStage(isAlreadyCompleted ? 4 : 0);
    setStageProgress(isAlreadyCompleted ? 1 : 0);
    setIsPacingDone(Boolean(isAlreadyCompleted));
  }

  // Рефы для надёжного доступа внутри таймера без устаревания замыканий
  const reportRef = useRef<VideoReport | null>(null);
  reportRef.current = report;

  const currentStageRef = useRef<number>(0);
  currentStageRef.current = currentStage;

  const stageStartTimeRef = useRef<number>(Date.now());
  const backendStageRef = useRef<number>(-1);
  /** Граница разобранного и момент, когда стала известна первая часть — см. backendStage */
  const trackingRef = useRef<Tracking>({ extractedUntil: 0, knownAt: null });
  /** Подписка на задачу: через неё экран шлёт позицию плеера и «проверь это утверждение» */
  const subRef = useRef<JobSubscription | null>(null);

  // Тип материала, пока бэкенд его не назвал: по введённому. Ссылка не на видеоплатформу — «ссылка»:
  // статья это или видео, станет ясно после job.started
  const kindHint = useMemo<ProgressKind>(() => {
    if (!cachedJob?.isUrl) return "text";
    const type = detectPlatform(cachedJob.input, true).type;
    return type === "youtube" || type === "shorts" || type === "tiktok" ? "video" : "link";
  }, [cachedJob]);

  // Подписка на обновление статуса задачи
  useEffect(() => {
    trackingRef.current = { extractedUntil: 0, knownAt: null };
    // Если проверка уже завершена, проверяем и синхронизируем отчёт при необходимости
    try {
      const existingJob = listJobs().find((j) => j.jobId === jobId);
      // готовый отчёт из истории — показываем сразу, но подписку не пропускаем: утверждения проверяются
      // по ходу просмотра, результаты приходят событиями
      if (existingJob?.report?.status === "completed") {
        setReport(existingJob.report);
        setIsPacingDone(true);
      }
    } catch {
      // Игнорируем ошибки при чтении из localStorage
    }

    const sub = subscribeJob(
      jobId,
      (updatedReport: VideoReport, event?: ServerEvent) => {
        if (updatedReport.status === "failed") {
          setError("Проверка завершилась с ошибкой на сервере.");
          return;
        }
        const now = Date.now();
        trackEvent(trackingRef.current, updatedReport, event, now);
        // бэкенд перешёл к следующему этапу — в лог, чтобы видеть, насколько полоса отстаёт от реального хода
        const bStage = backendStage(updatedReport, trackingRef.current, now);
        if (bStage !== backendStageRef.current) {
          backendStageRef.current = bStage;
          const claims = updatedReport.factChecks.length;
          console.log(
            `%c[проверка ${jobId.slice(0, 8)}]%c бэкенд: ${STAGE_NAMES[bStage] ?? "готово"}${claims ? ` · утверждений ${claims}` : ""}`,
            "color:#6E1EF0;font-weight:bold",
            "color:inherit",
          );
        }
        setReport(updatedReport);
      },
      (err: Error) => {
        setError(err.message);
      },
    );

    subRef.current = sub;

    return () => {
      sub.unsubscribe();
      subRef.current = null;
    };
  }, [jobId]);

  // Утверждений нет («привет», мнение, вопрос) — полосу не доигрываем: сразу на главную, там чудик из толпы
  // скажет это в облачке, а в поле вернётся введённое. Такая проверка в истории не нужна
  const nothingToCheck = report?.status === "completed" && report.factChecks.length === 0;
  useEffect(() => {
    if (!nothingToCheck || !report) return;
    const record = listJobs().find((j) => j.jobId === jobId);
    const pageUrl = report.video.pageUrl;
    const isUrl = record?.isUrl ?? Boolean(pageUrl && !pageUrl.startsWith("text:"));
    const rawInput = (isUrl ? pageUrl : (report.sourceText ?? record?.input)) ?? "";
    markCrowdSay({
      message: report.emptyNotice || getNonFactualMessage(rawInput, isUrl),
      input: rawInput,
      isUrl,
    });
    deleteJob(jobId);
    router.replace("/");
  }, [nothingToCheck]);

  // Таймер: полоса шага идёт за реальным ходом бэкенда (stageTarget) и плавно его догоняет. Шаг закрывается
  // только когда бэкенд его правда закончил; над которым работали — держится минимум 4 с, а готовый заранее
  // (из кэша, у видео нечего проверять до просмотра) — только отмечается галочкой
  useEffect(() => {
    if (isPacingDone) return;

    stageStartTimeRef.current = Date.now();
    let shown = 0;
    let lastLogged = -1;
    /** Шаг был готов уже в момент, когда стал текущим */
    let doneOnStart: boolean | null = null;
    logProgress(jobId, currentStageRef.current, 0, "этап начался");

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - stageStartTimeRef.current;
      const curStage = currentStageRef.current;
      const { target, done, why } = stageTarget(
        reportRef.current,
        trackingRef.current,
        curStage,
        elapsed,
        now,
      );
      doneOnStart ??= done;

      // догоняем цель плавно и никогда не откатываемся назад
      shown = Math.max(shown, shown + (target - shown) * (done ? 0.18 : 0.08));
      if (done && target - shown < 0.005) shown = 1;
      setStageProgress(shown);

      const percent = Math.floor(shown * 10) * 10;
      if (percent !== lastLogged) {
        lastLogged = percent;
        logProgress(jobId, curStage, percent, why);
      }

      const minMs = doneOnStart ? MIN_DONE_STAGE_MS : MIN_STAGE_DURATION_MS;
      if (elapsed < minMs || !done || shown < 1) return;
      if (curStage < 3) {
        currentStageRef.current = curStage + 1;
        stageStartTimeRef.current = Date.now();
        shown = 0;
        lastLogged = -1;
        doneOnStart = null;
        setCurrentStage(curStage + 1);
        setStageProgress(0);
      } else {
        logProgress(jobId, 4, 100, "первая часть готова, остальное — в разборе");
        setIsPacingDone(true);
      }
    }, 50);

    return () => {
      clearInterval(interval);
    };
  }, [isPacingDone]);

  // Проверять нечего — уходим на главную (эффект выше)
  if (nothingToCheck) return <BlankScreen />;

  // Разбор открывается после всех четырёх шагов загрузки — когда проверена первая часть (firstPart);
  // остальное проверяется дальше, экран обновляется вживую. Из истории — сразу.
  if (isPacingDone && report && report.status !== "failed") {
    const sourceText = report.sourceText ?? (cachedJob && !cachedJob.isUrl ? cachedJob.input : undefined);
    return (
      <VerificationScreen
        report={report}
        view={view}
        onViewChange={(v) => router.push(v === "tree" ? `/check/${jobId}?view=tree` : `/check/${jobId}`)}
        onGoHome={() => router.push("/")}
        onSend={(msg) => subRef.current?.send(msg)}
        sourceText={sourceText}
      />
    );
  }

  // Ошибка выполнения
  if (error) {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-[#F1EBE9] px-6 text-center text-[#4A3333]">
        <span className="text-2xl font-black">Не удалось загрузить проверку</span>
        <span className="max-w-[420px] text-sm font-semibold text-[#A27C7A]">{error}</span>
        <Link
          href="/"
          className="rounded-full bg-[#4A3333] px-5 py-2.5 text-sm font-extrabold text-white no-underline hover:bg-[#362424]"
        >
          Новая проверка
        </Link>
      </div>
    );
  }

  // Статус ещё неизвестен (ждём первый снапшот с бэка) — не показываем экран загрузки зря:
  // готовая проверка из базы должна открываться сразу отчётом
  if (!report) return <BlankScreen />;

  // Экран прогресса: четыре шага по реальному ходу бэкенда
  const part = report.status === "queued" ? null : firstPart(report, trackingRef.current);
  return (
    <ProgressScreen
      report={report}
      currentStage={currentStage}
      stageProgress={stageProgress}
      kindHint={kindHint}
      firstPartSize={part?.known ? part.need : undefined}
    />
  );
}

export default function Page() {
  // CheckPage при рендере читает историю из localStorage — на сервере её нет.
  // Чтобы первый клиентский рендер совпал с серверным (без hydration error), ждём монтирования.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <BlankScreen />;

  return (
    <Suspense fallback={<BlankScreen />}>
      <CheckPage />
    </Suspense>
  );
}
