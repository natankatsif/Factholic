"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HomeHero } from "../components/home/HomeHero";
import {
  bumpJob,
  createJob,
  deleteJob,
  findCompletedJob,
  subscribeJob,
  type JobSubscription,
} from "../lib/jobs";
import { markCrowdLaunch, markCrowdSay } from "../lib/history-ui";
import { getNonFactualMessage } from "../lib/claim-precheck";

const NO_CONNECTION = "Не достучался до сервера проверки 📡 Проверь интернет и попробуй ещё раз";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const activeSubRef = useRef<JobSubscription | null>(null);

  useEffect(() => {
    return () => {
      activeSubRef.current?.unsubscribe();
    };
  }, []);

  // Каждая проверка — отдельная страница /check/<jobId>: её можно обновить, переслать, открыть из истории
  const handleCheck = async (input: string, isUrl: boolean) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // То же видео или текст уже проверяли в этом браузере — сразу открываем готовый разбор из истории
    const existing = findCompletedJob(trimmed, isUrl);
    if (existing) {
      bumpJob(existing.jobId);
      markCrowdLaunch();
      router.push(`/check/${existing.jobId}`);
      return;
    }

    setIsLoading(true);
    activeSubRef.current?.unsubscribe();

    try {
      const jobId = await createJob(input, isUrl);

      // Для URL (видео/статьи) процесс обычно долгий, сразу переходим на экран анализа
      if (isUrl) {
        markCrowdLaunch();
        router.push(`/check/${jobId}`);
        return;
      }

      // Для текста: сначала ждём подтверждения наличия тезисов прямо на главной.
      // Переходим на /check/${jobId} ТОЛЬКО если найдены реальные утверждения!
      // Если утверждений нет (completed && factChecks === 0) — остаёмся на главной
      // и показываем реплику чудика в облачке, без раздражающего прыжка туда-обратно.
      await new Promise<void>((resolve) => {
        let finished = false;
        let timeoutId: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          activeSubRef.current?.unsubscribe();
          activeSubRef.current = null;
        };

        const proceedToAnalysis = () => {
          if (finished) return;
          finished = true;
          cleanup();
          markCrowdLaunch();
          router.push(`/check/${jobId}`);
          resolve();
        };

        const stayOnHomeEmpty = (notice?: string) => {
          if (finished) return;
          finished = true;
          cleanup();
          deleteJob(jobId);
          markCrowdSay({
            message: notice || getNonFactualMessage(input, false),
            input,
            isUrl: false,
          });
          setIsLoading(false);
          resolve();
        };

        // Таймаут безопасности: если бэкенд думает дольше 7 секунд,
        // не держим пользователя в лоадере — открываем экран анализа
        timeoutId = setTimeout(() => {
          proceedToAnalysis();
        }, 7000);

        activeSubRef.current = subscribeJob(
          jobId,
          (report, event) => {
            const hasClaims =
              (report.factChecks && report.factChecks.length > 0) ||
              event?.type === "claim.detected" ||
              event?.type === "claim.checked";

            if (hasClaims) {
              proceedToAnalysis();
              return;
            }

            if (report.status === "completed" && (!report.factChecks || report.factChecks.length === 0)) {
              stayOnHomeEmpty(report.emptyNotice);
              return;
            }

            if (report.status === "failed") {
              if (finished) return;
              finished = true;
              cleanup();
              deleteJob(jobId);
              showError(input, isUrl, "Проверка сломалась на сервере 😕 Попробуй ещё раз");
              resolve();
            }
          },
          (err) => {
            console.error("Home precheck error:", err);
            if (finished) return;
            finished = true;
            cleanup();
            showError(input, isUrl);
            resolve();
          },
        );
      });
    } catch (err) {
      console.error(err);
      showError(input, isUrl);
    }
  };

  // Ошибку не глотаем молча (на телефоне иначе кнопка секунду крутится — и тишина): бирюзовый говорит,
  // что случилось, введённое остаётся в поле
  const showError = (input: string, isUrl: boolean, message = NO_CONNECTION) => {
    setIsLoading(false);
    markCrowdSay({ message, input, isUrl });
  };

  return <HomeHero onCheck={handleCheck} isLoading={isLoading} />;
}
