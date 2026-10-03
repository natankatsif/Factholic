import React from "react";
import { Check, LoaderCircle } from "lucide-react";
import { formatTimecode, type VideoReport } from "@news/contracts";
import { plural } from "./filters";

export interface ProgressScreenProps {
  /** null — ещё не подключились к бэкенду */
  report: VideoReport | null;
  /** Текущий отображаемый этап проверки (0: текст, 1: тезисы, 2: источники, 3: дерево/вердикт) */
  currentStage?: number;
  /** Прогресс внутри текущего этапа (0..1) для плавной полоски */
  stageProgress?: number;
  /** Подсказка типа контента, когда report ещё null */
  kindHint?: "video" | "text" | "article";
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
function materialKind(
  report: VideoReport | null,
  kindHint?: "video" | "text" | "article",
): "video" | "text" | "article" {
  if (kindHint) return kindHint;
  const video = report?.video;
  if (!video) return "text";
  if (video.pageUrl.startsWith("text:")) return "text";
  if (video.platform !== "generic" || video.durationSec > 0) return "video";
  return "article";
}

const TITLES = {
  video: "Анализируем видео…",
  text: "Анализируем текст…",
  article: "Анализируем статью…",
};

const STAGE_BAR_COLORS = ["#0AA6C2", "#FFC20E", "#6E1EF0", "#1DA57A"];

/**
 * Строим 4 шага проверки с учётом гарантированного темпа этапов:
 * Каждый этап длится минимум 4 секунды с динамической сменой выражения лица персонажа.
 */
function buildSteps(
  report: VideoReport | null,
  displayStage: number,
  stageProgress: number,
  kindHint?: "video" | "text" | "article",
): Step[] {
  const kind = materialKind(report, kindHint);
  const claims = report?.factChecks ?? [];
  const total = claims.length;
  const completed = report?.status === "completed" && displayStage >= 3 && stageProgress >= 1;

  // Количество найденных источников
  const found = claims.reduce((n, fc) => n + (fc.sourcesFound ?? fc.sources?.length ?? 0), 0);
  const displayFound = found > 0 ? found : 8;
  const displayClaimsCount = total > 0 ? total : 3;

  // 1. Входной материал (Текст / Субтитры / Статья)
  const inputDone = displayStage > 0;
  const inputTitle = kind === "video" ? "Субтитры" : kind === "text" ? "Текст" : "Статья";
  const inputDetail = inputDone
    ? kind === "video" && report?.processedUntil
      ? formatTimecode(report.processedUntil)
      : "Получен"
    : kind === "text"
      ? "Читаем…"
      : kind === "video"
        ? report?.processedUntil
          ? `${formatTimecode(report.processedUntil)}…`
          : "Расшифровываем…"
        : "Загружаем…";

  // 2. Утверждения
  const claimsDone = displayStage > 1;
  const claimsActive = displayStage === 1;
  const claimsDetail = claimsDone
    ? `Найдено ${displayClaimsCount}`
    : claimsActive
      ? total > 0
        ? `Найдено ${total}`
        : "Ищем…"
      : "Ждёт текст";

  // 3. Источники
  const sourcesDone = displayStage > 2;
  const sourcesActive = displayStage === 2;
  const sourcesDetail = sourcesDone
    ? `${displayFound} ${plural(displayFound, ["источник", "источника", "источников"])}`
    : sourcesActive
      ? found > 0
        ? `${found} ${plural(found, ["источник", "источника", "источников"])}…`
        : "Ищем…"
      : "Ждёт утверждения";

  // 4. Дерево и консенсус
  const treeDone = completed;
  const treeActive = displayStage === 3;
  const treeDetail = treeDone
    ? `Готово для ${displayClaimsCount} ${plural(displayClaimsCount, ["утверждения", "утверждений", "утверждений"])}`
    : treeActive
      ? "Сверяем позиции…"
      : "Ждёт источники";

  return [
    {
      title: inputTitle,
      detail: inputDetail,
      state: inputDone ? "done" : "active",
      progress: displayStage === 0 ? stageProgress : 1,
    },
    {
      title: "Утверждения",
      detail: claimsDetail,
      state: claimsDone ? "done" : claimsActive ? "active" : "pending",
      progress: claimsActive ? stageProgress : claimsDone ? 1 : 0,
    },
    {
      title: "Источники",
      detail: sourcesDetail,
      state: sourcesDone ? "done" : sourcesActive ? "active" : "pending",
      progress: sourcesActive ? stageProgress : sourcesDone ? 1 : 0,
    },
    {
      title: "Дерево",
      detail: treeDetail,
      state: treeDone ? "done" : treeActive ? "active" : "pending",
      progress: treeActive ? stageProgress : 0,
    },
  ];
}

/** Экран, пока идёт проверка: персонаж меняет выражение и аксессуары по контексту шагов */
export function ProgressScreen({
  report,
  currentStage = 0,
  stageProgress = 0,
  kindHint,
}: ProgressScreenProps) {
  const steps = buildSteps(report, currentStage, stageProgress, kindHint);
  const kind = materialKind(report, kindHint);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#FBF8F7] px-6 py-8 text-[#4A3333]">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <StageFace stage={currentStage} />
        <h1 className="mt-5 text-center text-[24px] font-black tracking-[-0.5px] sm:text-[28px]">
          {TITLES[kind]}
        </h1>
        <p className="mt-1 text-center text-sm font-bold text-[#A27C7A]">
          Обычно это занимает 1–2 минуты
        </p>

        <ol className="mt-6 flex w-full list-none flex-col gap-1 p-0">
          {steps.map((s, idx) => (
            <li
              key={s.title}
              className={`flex flex-col rounded-[16px] px-4 py-2.5 transition-colors duration-300 ${
                s.state === "active" ? "bg-[#F1EBE9]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <StepIcon state={s.state} stageIndex={idx} />
                <span
                  className={`flex-1 text-[16px] font-black leading-tight ${
                    s.state === "pending" ? "text-[#A27C7A]" : ""
                  }`}
                >
                  {s.title}
                </span>
                <span className="shrink-0 text-sm font-bold text-[#A27C7A]">{s.detail}</span>
              </div>
              {s.state === "active" && s.progress !== undefined && (
                <span className="ml-[44px] mt-2 h-1.5 overflow-hidden rounded-full bg-[#E3D9D6]">
                  <span
                    className="block h-full rounded-full transition-[width] duration-150 ease-out"
                    style={{
                      width: `${Math.max(4, s.progress * 100)}%`,
                      backgroundColor: STAGE_BAR_COLORS[idx] ?? "#4AA5C3",
                    }}
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

function StepIcon({ state, stageIndex }: { state: StepState; stageIndex: number }) {
  if (state === "done") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1DA57A]/90 shadow-sm transition-transform duration-300">
        <Check className="h-4 w-4 text-white" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    const activeBg = STAGE_BAR_COLORS[stageIndex] ?? "#4AA5C3";
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: activeBg }}
      >
        <LoaderCircle className="h-4 w-4 animate-spin text-white" strokeWidth={3} />
      </span>
    );
  }
  return <span className="h-8 w-8 shrink-0 rounded-full bg-[#E3D9D6]" />;
}

const STAGE_CONFIGS = [
  {
    name: "reading",
    color: "#0AA6C2",
    shadow: "0px 14px 32px rgba(10,166,194,0.4), 0px 4px 12px rgba(74,51,51,0.12)",
  },
  {
    name: "claims",
    color: "#FFC20E",
    shadow: "0px 14px 32px rgba(255,194,14,0.45), 0px 4px 12px rgba(74,51,51,0.12)",
  },
  {
    name: "sources",
    color: "#6E1EF0",
    shadow: "0px 14px 32px rgba(110,30,240,0.4), 0px 4px 12px rgba(74,51,51,0.12)",
  },
  {
    name: "tree",
    color: "#1DA57A",
    shadow: "0px 14px 32px rgba(29,165,122,0.4), 0px 4px 12px rgba(74,51,51,0.12)",
  },
];

/**
 * Персонаж экрана анализа текста:
 * Кружочек остаётся на месте без прыжков вверх-вниз и плавно меняет цвет и выражение лица.
 * - Этап 0 (Текст): Учёный читатель в очках с бегающим взглядом.
 * - Этап 1 (Утверждения): Скептик с одной удивлённо поднятой бровью и хитрой ухмылкой.
 * - Этап 2 (Источники): Детектив с лупой и внимательными глазами.
 * - Этап 3 (Дерево/Вердикт): Эксперт с довольной широкой улыбкой и прищуренными глазами.
 */
export function StageFace({ stage = 0 }: { stage: number }) {
  const safeStage = Math.max(0, Math.min(3, stage));
  const cfg = STAGE_CONFIGS[safeStage];

  return (
    <div
      aria-hidden
      className="animate-stage-breathe relative h-[96px] w-[96px] select-none rounded-full"
      style={{
        backgroundColor: cfg.color,
        boxShadow: cfg.shadow,
        transition: "background-color 0.8s ease-in-out, box-shadow 0.8s ease-in-out",
      }}
    >
      {/* ====================================================================
          Этап 0: Читаем текст (Очки, сфокусированные брови, бегающий взгляд)
         ==================================================================== */}
      <div
        className={`absolute inset-0 transition-all duration-500 ease-in-out ${
          safeStage === 0
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Сфокусированные брови */}
        <div className="absolute left-[20px] top-[24px] h-[4px] w-[18px] rotate-[10deg] rounded-full bg-[#00000059]" />
        <div className="absolute right-[20px] top-[24px] h-[4px] w-[18px] rotate-[-10deg] rounded-full bg-[#00000059]" />
        {/* Оправа круглых очков */}
        <div className="absolute left-[18px] top-[30px] h-[26px] w-[26px] rounded-full border-[3px] border-[#00000059] bg-white/10" />
        <div className="absolute right-[18px] top-[30px] h-[26px] w-[26px] rounded-full border-[3px] border-[#00000059] bg-white/10" />
        <div className="absolute left-[44px] top-[41px] h-[3px] w-[8px] rounded-full bg-[#00000059]" />
        {/* Глаза, читающие текст слева направо */}
        <div className="animate-read-scan absolute left-[27px] top-[38px] h-[10px] w-[8px] rounded-full bg-[#00000059]" />
        <div className="animate-read-scan absolute right-[27px] top-[38px] h-[10px] w-[8px] rounded-full bg-[#00000059]" />
        {/* Собранный маленький рот */}
        <div className="absolute left-[39px] top-[66px] h-[5px] w-[18px] rounded-full bg-[#00000059]" />
      </div>

      {/* ====================================================================
          Этап 1: Ищем утверждения (Скептик: высоко поднятая бровь, задумчивый взгляд)
         ==================================================================== */}
      <div
        className={`absolute inset-0 transition-all duration-500 ease-in-out ${
          safeStage === 1
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Левая бровь поднята высоко в удивлении, правая слегка нахмурена */}
        <div className="absolute left-[20px] top-[18px] h-[5px] w-[22px] rotate-[-18deg] rounded-full bg-[#00000059]" />
        <div className="absolute right-[22px] top-[30px] h-[5px] w-[20px] rotate-[10deg] rounded-full bg-[#00000059]" />
        {/* Глаза смотрят вверх и вбок, обдумывая тезис */}
        <div
          style={{ animation: "eye-blink-1 4.5s infinite" }}
          className="absolute left-[30px] top-[32px] h-[14px] w-[10px] rounded-full bg-[#00000059]"
        />
        <div
          style={{ animation: "eye-blink-1 4.5s infinite" }}
          className="absolute right-[24px] top-[32px] h-[14px] w-[10px] rounded-full bg-[#00000059]"
        />
        {/* Скептическая полуулыбка под углом */}
        <div className="absolute left-[37px] top-[66px] h-[5px] w-[22px] rotate-[-10deg] rounded-full bg-[#00000059]" />
      </div>

      {/* ====================================================================
          Этап 2: Ищем первоисточники (Детектив с лупой и широкими глазами)
         ==================================================================== */}
      <div
        className={`absolute inset-0 transition-all duration-500 ease-in-out ${
          safeStage === 2
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Внимательные брови */}
        <div className="absolute left-[18px] top-[22px] h-[5px] w-[20px] rotate-[-8deg] rounded-full bg-[#00000059]" />
        <div className="absolute right-[18px] top-[22px] h-[5px] w-[20px] rotate-[8deg] rounded-full bg-[#00000059]" />
        {/* Лупа над левым глазом */}
        <div className="absolute left-[14px] top-[28px] h-[30px] w-[30px] rounded-full border-[3px] border-[#00000059] bg-white/20" />
        <div className="absolute left-[10px] top-[54px] h-[4px] w-[12px] rotate-[45deg] rounded-full bg-[#00000059]" />
        {/* Увеличенный глаз сквозь лупу и внимательный правый глаз */}
        <div className="animate-detective-scan absolute left-[22px] top-[36px] h-[14px] w-[14px] rounded-full bg-[#00000059]" />
        <div className="animate-detective-scan absolute right-[26px] top-[37px] h-[12px] w-[10px] rounded-full bg-[#00000059]" />
        {/* Открытый в удивлении рот :o */}
        <div className="absolute left-[40px] top-[64px] h-[16px] w-[16px] rounded-full bg-[#00000059]" />
      </div>

      {/* ====================================================================
          Этап 3: Дерево и консенсус (Довольный эксперт: улыбка, счастливые глаза)
         ==================================================================== */}
      <div
        className={`absolute inset-0 transition-all duration-500 ease-in-out ${
          safeStage === 3
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Расслабленные дружелюбные брови */}
        <div className="absolute left-[22px] top-[26px] h-[4px] w-[18px] rotate-[6deg] rounded-full bg-[#00000059]" />
        <div className="absolute right-[22px] top-[26px] h-[4px] w-[18px] rotate-[-6deg] rounded-full bg-[#00000059]" />
        {/* Счастливые прищуренные глаза (^ ^) */}
        <svg
          viewBox="0 0 20 12"
          className="absolute left-[22px] top-[36px] h-[12px] w-[18px] text-[#00000059]"
        >
          <path
            d="M2 10 C4 2 14 2 16 10"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <svg
          viewBox="0 0 20 12"
          className="absolute right-[22px] top-[36px] h-[12px] w-[18px] text-[#00000059]"
        >
          <path
            d="M2 10 C4 2 14 2 16 10"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        {/* Милый румянец на щёчках */}
        <div className="absolute left-[16px] top-[48px] h-[7px] w-[11px] rounded-full bg-white/30" />
        <div className="absolute right-[16px] top-[48px] h-[7px] w-[11px] rounded-full bg-white/30" />
        {/* Широкая уверенная улыбка */}
        <svg
          viewBox="0 0 44 24"
          className="absolute left-[27px] top-[56px] h-[22px] w-[42px] text-[#00000059]"
        >
          <path
            d="M4 6 C4 18 14 22 22 22 C30 22 40 18 40 6"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}

/** Совместимость с экспортом ThinkingFace */
export const ThinkingFace = StageFace;
