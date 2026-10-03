"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { ServerEvent, VideoReport } from "@news/contracts";
import { VerificationScreen, type VerificationView } from "../../../components/verification";
import { subscribeJob } from "../../../lib/jobs";

type LoadState =
  | { status: "loading"; progressText?: string; title?: string }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ok"; report: VideoReport };

/** Страница одной проверки: /check/<jobId>. Дерево источников — /check/<jobId>?view=tree */
function CheckPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: VerificationView = searchParams.get("view") === "tree" ? "tree" : "analysis";
  const [state, setState] = useState<LoadState>({
    status: "loading",
    progressText: "Подключаемся к сервису проверки…",
  });

  useEffect(() => {
    const unsubscribe = subscribeJob(
      jobId,
      (report: VideoReport, event?: ServerEvent) => {
        if (report.status === "failed") {
          setState({ status: "error", message: "Проверка завершилась с ошибкой на сервере." });
          return;
        }

        // Если уже есть найденные утверждения или проверка завершена — показываем экран разбора
        if (report.factChecks.length > 0 || report.status === "completed") {
          setState({ status: "ok", report });
          return;
        }

        // Иначе обновляем статус на экране ожидания
        let progressText = "Анализируем материал…";
        if (event?.type === "job.progress") {
          if (event.stage === "transcription") progressText = "Распознаём речь и разбираем предложения…";
          else if (event.stage === "claim_extraction") progressText = "Выделяем проверяемые утверждения…";
          else if (event.stage === "source_search") progressText = "Ищем первоисточники и публикации…";
          else if (event.stage === "verification") progressText = "Сверяем факты и проверяем консенсус…";
        } else if (event?.type === "job.started") {
          progressText = "Материал получен, ищем факты…";
        }

        setState({
          status: "loading",
          progressText,
          title: report.video?.title || undefined,
        });
      },
      (err: Error) => {
        setState({ status: "error", message: err.message });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [jobId]);

  if (state.status === "ok") {
    return (
      <VerificationScreen
        report={state.report}
        view={view}
        onViewChange={(v) => router.push(v === "tree" ? `/check/${jobId}?view=tree` : `/check/${jobId}`)}
        onGoHome={() => router.push("/")}
      />
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-[#F1EBE9] px-6 text-center text-[#4A3333]">
      {state.status === "loading" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#4A3333] border-t-transparent" />
          <span className="text-xl font-black text-[#4A3333]">
            {state.title ? `«${state.title}»` : "Проверяем материал…"}
          </span>
          <span className="text-sm font-semibold text-[#A27C7A]">
            {state.progressText ?? "Загружаем проверку…"}
          </span>
        </div>
      ) : (
        <>
          <span className="text-2xl font-black">
            {state.status === "missing" ? "Проверка не найдена" : "Не удалось загрузить проверку"}
          </span>
          <span className="max-w-[420px] text-sm font-semibold text-[#A27C7A]">
            {state.status === "missing"
              ? "Возможно, ссылка устарела или проверка была сделана в другом браузере."
              : state.message}
          </span>
          <Link
            href="/"
            className="rounded-full bg-[#4A3333] px-5 py-2.5 text-sm font-extrabold text-white no-underline hover:bg-[#362424]"
          >
            Новая проверка
          </Link>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[100svh] bg-[#F1EBE9]" />}>
      <CheckPage />
    </Suspense>
  );
}
