"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { VideoReport } from "@news/contracts";
import { ProgressScreen, VerificationScreen, type VerificationView } from "../../../components/verification";
import { listJobs, subscribeJob } from "../../../lib/jobs";

/** Минимальное время отображения каждого этапа (4 секунды) */
const MIN_STAGE_DURATION_MS = 4000;

/**
 * Определяет текущую готовность этапов на бэкенде:
 * 0: Текст / Расшифровка
 * 1: Извлечение тезисов
 * 2: Поиск источников
 * 3: Построение дерева и консенсуса
 * 4: Полностью завершено
 */
function getBackendStage(report: VideoReport | null): number {
  if (!report) return 0;
  if (report.status === "completed") return 4;
  if (report.status === "queued") return 0;
  if (report.stage === "transcription" || report.stage === "ingest") return 0;
  if (report.stage === "claim_extraction") return 1;

  const claims = report.factChecks ?? [];
  if (claims.length === 0) return 1;

  const hasTree = claims.some(
    (fc) => fc.stage === "provenance" || fc.stage === "stances" || fc.status === "done",
  );
  if (hasTree) return 3;

  return 2;
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

  // Подсказка типа материала из истории / localStorage (например, текст vs видео)
  const kindHint = useMemo<"video" | "text" | "article">(() => {
    if (cachedJob) return cachedJob.isUrl ? "video" : "text";
    return "text";
  }, [cachedJob]);

  // Подписка на обновление статуса задачи
  useEffect(() => {
    // Если проверка уже завершена, проверяем и синхронизируем отчёт при необходимости
    try {
      const existingJob = listJobs().find((j) => j.jobId === jobId);
      if (existingJob?.report?.status === "completed") {
        setReport(existingJob.report);
        setIsPacingDone(true);
        return;
      }
    } catch {}

    const unsubscribe = subscribeJob(
      jobId,
      (updatedReport: VideoReport) => {
        if (updatedReport.status === "failed") {
          setError("Проверка завершилась с ошибкой на сервере.");
          return;
        }
        if (updatedReport.status === "completed") {
          // Если задача уже готова на сервере (например, была завершена ранее) — сразу завершаем пейсинг
          setIsPacingDone(true);
        }
        setReport(updatedReport);
      },
      (err: Error) => {
        setError(err.message);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [jobId]);

  // Таймер темпа: гарантирует не менее 4 секунд на каждый из 4 этапов
  useEffect(() => {
    if (isPacingDone) return;

    stageStartTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - stageStartTimeRef.current;
      const progress = Math.min(1, elapsed / MIN_STAGE_DURATION_MS);
      setStageProgress(progress);

      if (elapsed >= MIN_STAGE_DURATION_MS) {
        const bStage = getBackendStage(reportRef.current);
        const curStage = currentStageRef.current;

        if (curStage < 3) {
          // Переход к следующему этапу, если бэкенд продвинулся дальше
          if (bStage > curStage) {
            currentStageRef.current = curStage + 1;
            stageStartTimeRef.current = Date.now();
            setCurrentStage(curStage + 1);
            setStageProgress(0);
          }
        } else if (curStage === 3) {
          // Завершение экрана прогресса только после отработки 4-го этапа и готовности отчёта
          if (reportRef.current?.status === "completed") {
            setIsPacingDone(true);
          }
        }
      }
    }, 50);

    return () => {
      clearInterval(interval);
    };
  }, [isPacingDone]);

  // Отображение готового отчета после прохождения всех этапов
  if (isPacingDone && report && report.status === "completed") {
    if (report.factChecks.length > 0) {
      return (
        <VerificationScreen
          report={report}
          view={view}
          onViewChange={(v) => router.push(v === "tree" ? `/check/${jobId}?view=tree` : `/check/${jobId}`)}
          onGoHome={() => router.push("/")}
        />
      );
    }

    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-[#F1EBE9] px-6 text-center text-[#4A3333]">
        <span className="text-2xl font-black">Проверяемых утверждений не нашлось</span>
        <span className="max-w-[420px] text-sm font-semibold text-[#A27C7A]">
          В материале нет конкретных фактов, которые можно сверить с источниками: только мнения,
          вопросы или оценки.
        </span>
        <Link
          href="/"
          className="rounded-full bg-[#4A3333] px-5 py-2.5 text-sm font-extrabold text-white no-underline hover:bg-[#362424]"
        >
          Новая проверка
        </Link>
      </div>
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

  // Экран прогресса с динамическим персонажем и таймингом не менее 4 секунд на этап
  return (
    <ProgressScreen
      report={report}
      currentStage={currentStage}
      stageProgress={stageProgress}
      kindHint={kindHint}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ProgressScreen report={null} />}>
      <CheckPage />
    </Suspense>
  );
}
