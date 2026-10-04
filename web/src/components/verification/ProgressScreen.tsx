import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { formatTimecode, isPendingCheck, type VideoReport } from "@news/contracts";
import { plural } from "./filters";
import { Blob, type ProgressMood } from "./CornerEmojis";
import { materialKind as reportMaterialKind, type MaterialKind } from "./material";
import { clearBlobReturn, markBlobReturn, takeCrowdLaunch } from "../../lib/history-ui";

/** Что проверяем. «link» — ссылка не на видеоплатформу, пока бэкенд не сказал, статья это или видео */
export type ProgressKind = MaterialKind | "link";

export interface ProgressScreenProps {
  /** null — ещё не подключились к бэкенду */
  report: VideoReport | null;
  /** Текущий отображаемый этап проверки (0: текст, 1: тезисы, 2: источники, 3: дерево/вердикт) */
  currentStage?: number;
  /** Прогресс внутри текущего этапа (0..1) для плавной полоски */
  stageProgress?: number;
  /** Тип материала по введённому — пока бэкенд не прислал job.started */
  kindHint?: ProgressKind;
  /**
   * Сколько утверждений проверяется до открытия разбора; undefined — ещё неизвестно.
   * 0 — проверять заранее нечего (у длинного видео первое утверждение дальше 30 с): проверим по ходу просмотра
   */
  firstPartSize?: number;
}

type StepState = "done" | "active" | "pending";

interface Step {
  title: string;
  detail: string;
  state: StepState;
  /** 0..1 — полоса прогресса у активного шага */
  progress?: number;
}

/**
 * Что проверяем: от этого зависят заголовок и первый шаг. Бэкенд уже открыл материал (job.started) — верим
 * ему (ссылка оказалась статьёй или видео), до этого — подсказке по введённому.
 */
function materialKind(report: VideoReport | null, kindHint?: ProgressKind): ProgressKind {
  if (report && report.status !== "queued" && report.video.pageUrl) return reportMaterialKind(report.video);
  return kindHint ?? (report ? reportMaterialKind(report.video) : "text");
}

const TITLES: Record<ProgressKind, string> = {
  video: "Анализируем видео…",
  text: "Анализируем текст…",
  article: "Анализируем статью…",
  link: "Анализируем ссылку…",
};

const INPUT_TITLES: Record<ProgressKind, string> = {
  video: "Субтитры",
  text: "Текст",
  article: "Статья",
  link: "Страница",
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
  kindHint?: ProgressKind,
  firstPartSize?: number,
): Step[] {
  const kind = materialKind(report, kindHint);
  const claims = report?.factChecks ?? [];
  const total = claims.length;
  const completed = displayStage >= 3 && stageProgress >= 1;
  /** У длинного видео в первых 30 с утверждений нет — источники и дерево проверятся по ходу просмотра */
  const later = firstPartSize === 0;

  // Количество найденных источников
  const found = claims.reduce((n, fc) => n + (fc.sourcesFound ?? fc.sources?.length ?? 0), 0);
  const checked = claims.filter((fc) => !isPendingCheck(fc)).length;

  // 1. Входной материал (Текст / Субтитры / Статья)
  const inputDone = displayStage > 0;
  const inputTitle = INPUT_TITLES[kind];
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
    ? total > 0
      ? `Найдено ${total}`
      : "Пока нет"
    : claimsActive
      ? total > 0
        ? `Найдено ${total}`
        : "Ищем…"
      : "Ждёт текст";

  // 3. Источники
  const sourcesDone = displayStage > 2;
  const sourcesActive = displayStage === 2;
  const sourcesDetail = later
    ? "По ходу просмотра"
    : sourcesDone
      ? found > 0
        ? `${found} ${plural(found, ["источник", "источника", "источников"])}`
        : "Готово"
      : sourcesActive
        ? found > 0
          ? `${found} ${plural(found, ["источник", "источника", "источников"])}…`
          : "Ищем…"
        : "Ждёт утверждения";

  // 4. Дерево и консенсус
  const treeDone = completed;
  const treeActive = displayStage === 3;
  // открываем после первой части: «проверено 3 из 8» — остальные догрузятся в разборе
  const treeDetail = later
    ? "По ходу просмотра"
    : treeDone
      ? checked < total
        ? `Проверено ${checked} из ${total}`
        : `Готово для ${total} ${plural(total, ["утверждения", "утверждений", "утверждений"])}`
      : treeActive
        ? checked > 0
          ? `Проверено ${checked}…`
          : "Сверяем позиции…"
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
  firstPartSize,
}: ProgressScreenProps) {
  const steps = buildSteps(report, currentStage, stageProgress, kindHint, firstPartSize);
  const kind = materialKind(report, kindHint);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#FBF8F7] px-6 py-8 text-[#4A3333]">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <StageFace stage={currentStage} />
        <h1 className="mt-5 text-center text-[24px] font-black tracking-[-0.5px] sm:text-[28px]">
          {TITLES[kind]}
        </h1>
        <p className="mt-1 text-center text-sm font-bold text-[#A27C7A]">Обычно это занимает 1–2 минуты</p>

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

const STAGE_MOODS: ProgressMood[] = ["reading", "claims", "sources", "done"];
const FACE_SIZE = 96;
/** Сколько чудик побудет «как на главной», прежде чем начать превращаться в читающего */
const CROWD_MS = 700;
/** Перелёт из толпы главной в центр экрана анализа */
const LAUNCH_MS = 900;

/**
 * Персонаж экрана анализа — тот же чудик, что в углу разбора (CornerEmojis). Приходит бирюзовым из толпы
 * главной, превращается в читающего и дальше меняется по этапам: лицо и цвет плавно перетекают, глаза
 * следят за мышкой. Этап 0 — читает, 1 — ищет утверждения (скептик), 2 — источники (внимательный),
 * 3 — готово (довольный). Когда откроется разбор, чудик прилетит отсюда в угол карточки
 * (место и эмоция — через markBlobReturn).
 */
export function StageFace({ stage = 0 }: { stage: number }) {
  const safeStage = Math.max(0, Math.min(3, stage));
  // запустили проверку с главной — вылетаем из толпы (место запомнил markCrowdLaunch)
  const [launch] = useState(() => takeCrowdLaunch());
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), CROWD_MS + (launch ? LAUNCH_MS : 0));
    return () => clearTimeout(t);
  }, [launch]);
  const mood: ProgressMood = arrived ? STAGE_MOODS[safeStage] : "crowd";

  // Держим место и эмоцию чудика наготове: разбор рендерится раньше, чем этот экран размонтируется,
  // поэтому записываем заранее, а не при уходе. Ушли не в разбор — убираем.
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const save = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) markBlobReturn({ left: r.left, top: r.top, size: FACE_SIZE, mood });
    };
    save();
    window.addEventListener("resize", save);
    return () => window.removeEventListener("resize", save);
  }, [mood]);
  useLayoutEffect(() => () => clearBlobReturn(), []);

  // перелёт: из места и размера бирюзового в толпе — сюда, уменьшаясь (центр к центру)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !launch) return;
    // эффект может сработать дважды (StrictMode в dev): мерить надо место без уже запущенного перелёта,
    // иначе второй замер берёт чудика в толпе и полёт стартует не оттуда
    el.getAnimations().forEach((a) => a.cancel());
    const r = el.getBoundingClientRect();
    const size = launch.size ?? FACE_SIZE;
    const dx = launch.left + size / 2 - (r.left + r.width / 2);
    const dy = launch.top + size / 2 - (r.top + r.height / 2);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${size / FACE_SIZE})` }, { transform: "none" }],
      { duration: LAUNCH_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
    );
  }, [launch]);

  return (
    <div ref={ref} aria-hidden className="relative z-10" style={{ transformOrigin: "center" }}>
      <Blob mood={mood} size={FACE_SIZE} />
    </div>
  );
}

/** Совместимость с экспортом ThinkingFace */
export const ThinkingFace = StageFace;
