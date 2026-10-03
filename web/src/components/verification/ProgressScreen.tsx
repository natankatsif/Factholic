import React from "react";
import { Check, LoaderCircle } from "lucide-react";
import { formatTimecode, type VideoReport } from "@news/contracts";
import { plural } from "./filters";

export interface ProgressScreenProps {
  /** null — ещё не подключились к бэкенду */
  report: VideoReport | null;
}

type StepState = "done" | "active" | "pending";

interface Step {
  title: string;
  detail: string;
  state: StepState;
  /** 0..1 — полоса прогресса у активного шага */
  progress?: number;
}

/** Что проверяем: от этого зависят заголовок и первый шаг */
function materialKind(report: VideoReport | null): "video" | "text" | "article" {
  const video = report?.video;
  if (!video) return "video";
  if (video.pageUrl.startsWith("text:")) return "text";
  if (video.platform !== "generic" || video.durationSec > 0) return "video";
  return "article";
}

const TITLES = { video: "Анализируем видео…", text: "Анализируем текст…", article: "Анализируем статью…" };

/**
 * Шаги считаются из самого отчёта, а не из последнего события — после перезагрузки страницы прогресс тот же.
 * Состояния — с бэкенда: report.stage (материал: куски → "verification", когда разобран целиком)
 * и factCheck.stage у каждого тезиса (поиск источников → дерево → стороны).
 */
function buildSteps(report: VideoReport | null): Step[] {
  const kind = materialKind(report);
  const claims = report?.factChecks ?? [];
  const total = claims.length;
  const completed = report?.status === "completed";
  const started = !!report && report.status !== "queued";
  const extracted = completed || report?.stage === "verification";

  const checking = claims.filter((fc) => fc.status === "checking");
  const searching = checking.filter((fc) => !fc.stage || fc.stage === "source_search").length;
  const searched = total - searching;
  const checked = total - checking.length;
  const onTree = checking.some((fc) => fc.stage === "provenance");
  const onStances = checking.some((fc) => fc.stage === "stances");

  // сколько источников нашёл поиск: у проверенных тезисов sources — только релевантные, поэтому сначала sourcesFound
  const found = claims
    .filter((fc) => fc.status !== "checking" || (fc.stage && fc.stage !== "source_search"))
    .reduce((n, fc) => n + (fc.sourcesFound ?? fc.sources.length), 0);

  const inputDone = kind === "video" ? extracted : started || extracted;
  const sourcesDone = extracted && searching === 0;
  // счётчик тезисов имеет смысл, только когда их несколько
  const ofClaims = (n: number) => (total > 1 ? ` · ${n} из ${total}` : "");

  const input: Step =
    kind === "video"
      ? {
          title: "Субтитры",
          detail: report?.processedUntil
            ? `${formatTimecode(report.processedUntil)}${inputDone ? "" : "…"}`
            : started
              ? "Расшифровываем…"
              : "Скачиваем…",
          state: inputDone ? "done" : "active",
        }
      : {
          title: kind === "text" ? "Текст" : "Статья",
          detail: inputDone ? "Получен" : kind === "text" ? "Читаем…" : "Загружаем…",
          state: inputDone ? "done" : "active",
        };

  return [
    input,
    {
      title: "Утверждения",
      detail: total > 0 ? `Найдено ${total}` : extracted ? "Не найдено" : "Ищем…",
      state: extracted ? "done" : inputDone || report?.stage ? "active" : "pending",
    },
    {
      title: "Источники",
      detail:
        total === 0
          ? "Ждёт утверждения"
          : searched === 0
            ? "Ищем…"
            : `${found} ${plural(found, ["источник", "источника", "источников"])}${searching > 0 ? "…" : ""}`,
      state: sourcesDone ? "done" : searching > 0 ? "active" : "pending",
      progress: total > 0 ? searched / total : 0,
    },
    {
      title: "Дерево",
      detail: completed
        ? `Готово для ${total} ${plural(total, ["утверждения", "утверждений", "утверждений"])}`
        : onStances && !onTree
          ? `Сверяем позиции${ofClaims(checked)}`
          : onTree || onStances
            ? `Строим${ofClaims(checked)}`
            : sourcesDone
              ? "Собираем отчёт…"
              : "Ждёт источники",
      state: completed ? "done" : onTree || onStances || sourcesDone ? "active" : "pending",
      progress: total > 0 ? checked / total : 0,
    },
  ];
}

/** Экран, пока идёт проверка: смайлик, заголовок по типу материала и четыре шага (макет «Анализируем видео…») */
export function ProgressScreen({ report }: ProgressScreenProps) {
  const steps = buildSteps(report);
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#FBF8F7] px-6 py-8 text-[#4A3333]">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <ThinkingFace />
        <h1 className="mt-5 text-center text-[24px] font-black tracking-[-0.5px] sm:text-[28px]">
          {TITLES[materialKind(report)]}
        </h1>
        <p className="mt-1 text-center text-sm font-bold text-[#A27C7A]">Обычно это занимает 1–2 минуты</p>

        <ol className="mt-6 flex w-full list-none flex-col gap-1 p-0">
          {steps.map((s) => (
            <li
              key={s.title}
              className={`flex flex-col rounded-[16px] px-4 py-2.5 ${s.state === "active" ? "bg-[#F1EBE9]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <StepIcon state={s.state} />
                <span
                  className={`flex-1 text-[16px] font-black leading-tight ${s.state === "pending" ? "text-[#A27C7A]" : ""}`}
                >
                  {s.title}
                </span>
                <span className="shrink-0 text-sm font-bold text-[#A27C7A]">{s.detail}</span>
              </div>
              {s.state === "active" && s.progress !== undefined && (
                <span className="ml-[44px] mt-2 h-1.5 overflow-hidden rounded-full bg-[#E3D9D6]">
                  <span
                    className="block h-full rounded-full bg-[#4AA5C3] transition-[width] duration-500"
                    style={{ width: `${Math.max(4, s.progress * 100)}%` }}
                  />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1DA57A]/85">
        <Check className="h-4 w-4 text-white" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4AA5C3]">
        <LoaderCircle className="h-4 w-4 animate-spin text-white" strokeWidth={3} />
      </span>
    );
  }
  return <span className="h-8 w-8 shrink-0 rounded-full bg-[#E3D9D6]" />;
}

/** Задумчивый смайлик из макета: дышит и моргает (анимации из globals.css, как у смайликов на главной) */
function ThinkingFace() {
  return (
    <div
      aria-hidden
      className="relative h-[88px] w-[88px] rounded-full bg-[#4AA5C3]"
      style={{ animation: "blob-breathe-1 4s ease-in-out infinite" }}
    >
      <span
        className="absolute left-[25px] top-[33px] h-[12px] w-[10px] rounded-full bg-[#00000059]"
        style={{ animation: "eye-blink-1 5s infinite" }}
      />
      <span
        className="absolute right-[25px] top-[33px] h-[12px] w-[10px] rounded-full bg-[#00000059]"
        style={{ animation: "eye-blink-1 5s infinite" }}
      />
      <span className="absolute left-[33px] top-[58px] h-[6px] w-[22px] rounded-full bg-[#00000059]" />
    </div>
  );
}
