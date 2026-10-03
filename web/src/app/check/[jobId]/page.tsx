"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { VideoReport } from "@news/contracts";
import { ProgressScreen, VerificationScreen, type VerificationView } from "../../../components/verification";
import { subscribeJob } from "../../../lib/jobs";

type LoadState =
  /** Проверка идёт: экран прогресса. report null — ещё не подключились */
  | { status: "progress"; report: VideoReport | null }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ok"; report: VideoReport };

/** Страница одной проверки: /check/<jobId>. Дерево источников — /check/<jobId>?view=tree */
function CheckPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: VerificationView = searchParams.get("view") === "tree" ? "tree" : "analysis";
  const [state, setState] = useState<LoadState>({ status: "progress", report: null });

  useEffect(() => {
    const unsubscribe = subscribeJob(
      jobId,
      (report: VideoReport) => {
        if (report.status === "failed") {
          setState({ status: "error", message: "Проверка завершилась с ошибкой на сервере." });
          return;
        }
        // Экран разбора — только когда проверка закончена, до этого — шаги прогресса
        setState(report.status === "completed" ? { status: "ok", report } : { status: "progress", report });
      },
      (err: Error) => {
        setState({ status: "error", message: err.message });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [jobId]);

  if (state.status === "ok" && state.report.factChecks.length > 0) {
    return (
      <VerificationScreen
        report={state.report}
        view={view}
        onViewChange={(v) => router.push(v === "tree" ? `/check/${jobId}?view=tree` : `/check/${jobId}`)}
        onGoHome={() => router.push("/")}
      />
    );
  }

  if (state.status === "progress") return <ProgressScreen report={state.report} />;

  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-[#F1EBE9] px-6 text-center text-[#4A3333]">
      <span className="text-2xl font-black">
        {state.status === "missing"
          ? "Проверка не найдена"
          : state.status === "ok"
            ? "Проверяемых утверждений не нашлось"
            : "Не удалось загрузить проверку"}
      </span>
      <span className="max-w-[420px] text-sm font-semibold text-[#A27C7A]">
        {state.status === "missing"
          ? "Возможно, ссылка устарела или проверка была сделана в другом браузере."
          : state.status === "ok"
            ? "В материале нет конкретных фактов, которые можно сверить с источниками: только мнения, вопросы или оценки."
            : state.message}
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

export default function Page() {
  return (
    <Suspense fallback={<ProgressScreen report={null} />}>
      <CheckPage />
    </Suspense>
  );
}
