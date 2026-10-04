"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FloatingPills } from "./FloatingPills";
import {
  BlueFace,
  TealFace,
  GreenFace,
  PurpleFace,
  RedFace,
  PinkFace,
  YellowFace,
  OrangeFace,
} from "./blob-faces";
import { type PlatformId } from "./SupportedPlatforms";

export interface EmojiCrowdProps {
  isTyping?: boolean;
  hasText?: boolean;
  platform?: PlatformId | null;
  /** Реплика бирюзового: облачко слева от него, рот «говорит», пока печатается текст */
  speech?: string | null;
  /** Реплику напечатали и дали прочитать — пора убрать (облачко уйдёт плавно, когда speech станет null) */
  onSpeechEnd?: () => void;
}

/** Скорость «речи»: мс на символ — с ней печатается облачко и шевелится рот */
const SPEECH_MS_PER_CHAR = 32;
/** Сколько облачко висит после того, как допечаталось: время прочитать (мс на символ) + запас */
const SPEECH_READ_MS_PER_CHAR = 30;
const SPEECH_HOLD_MS = 4000;

/** Облачко реплики: выскакивает из бирюзового и печатает текст по буквам */
function SpeechBubble({ text, leaving, onGone }: { text: string; leaving: boolean; onGone: () => void }) {
  // по символам, а не по UTF-16: эмодзи не рвётся пополам
  const chars = useMemo(() => Array.from(text), [text]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(chars.length);
      return;
    }
    const timer = setInterval(() => {
      setShown((n) => {
        if (n >= chars.length) clearInterval(timer);
        return Math.min(chars.length, n + 1);
      });
    }, SPEECH_MS_PER_CHAR);
    return () => clearInterval(timer);
  }, [chars]);

  // Слева от бирюзового (left 320). На десктопе растёт вверх над толпой; на мобильном толпа обрезана
  // сверху — облачко ниже, поверх синего
  return (
    <div
      data-pencil-name="Speech Bubble"
      style={{
        animation: leaving
          ? "bubble-out 0.3s cubic-bezier(0.22, 1, 0.36, 1) both"
          : "bubble-pop 0.42s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
      onAnimationEnd={(e) => {
        if (leaving && e.animationName === "bubble-out") onGone();
      }}
      className="absolute right-[420px] top-[14px] [z-index:20] w-[330px] origin-bottom-right rounded-[26px] rounded-br-[8px] bg-[#FBF8F7] px-6 py-4 text-left text-[23px] font-extrabold leading-snug text-[#4A3333] [box-shadow:0px_14px_32px_rgba(74,51,51,0.16),0px_2px_6px_rgba(74,51,51,0.08)] [outline:2px_solid_#E2D7D4] [outline-offset:-1px] lg:top-auto lg:bottom-[404px] lg:w-[320px] lg:text-[21px]"
    >
      {/* Невидимый полный текст держит размер облачка, видимый печатается поверх */}
      <span className="invisible">{text}</span>
      <span className="absolute inset-0 px-6 py-4">{chars.slice(0, shown).join("")}</span>
      {/* Хвостик к бирюзовому */}
      <svg
        aria-hidden
        viewBox="0 0 28 22"
        className="absolute -right-[22px] bottom-[6px] h-[22px] w-[28px] overflow-visible"
      >
        <path d="M0 2 C10 8 18 10 27 20 C17 19 8 18 0 16 Z" fill="#FBF8F7" />
        <path d="M0 2 C10 8 18 10 27 20 C17 19 8 18 0 16" fill="none" stroke="#E2D7D4" strokeWidth="2" />
      </svg>
    </div>
  );
}

interface BlobReactionState {
  variant: number;
  isReacting: boolean;
  isDead?: boolean;
  isReviving?: boolean;
}

/** Парящий смайлик скелета / черепа при гибели персонажа (💀) */
function DeadSkull() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 -top-8 -translate-x-1/2 z-30 select-none flex items-center justify-center"
      style={{
        animation: "ghost-float 2.4s ease-out forwards",
      }}
    >
      <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)] select-none">💀</span>
    </div>
  );
}

/**
 * Центры каждого персонажа в системе координат толпы (740×524)
 * и максимальный радиус смещения взгляда с учётом глубины слоя (параллакс).
 */
const BLOBS = [
  {
    id: 0,
    name: "Blue Blob",
    cx: 250,
    cy: 190,
    maxGaze: 9,
  },
  {
    id: 1,
    name: "Teal Blob",
    cx: 445,
    cy: 165,
    maxGaze: 9,
  },
  {
    id: 2,
    name: "Green Blob",
    cx: 595,
    cy: 205,
    maxGaze: 11,
  },
  {
    id: 3,
    name: "Purple Blob",
    cx: 725,
    cy: 305,
    maxGaze: 11,
  },
  {
    id: 4,
    name: "Red Blob",
    cx: 140,
    cy: 360,
    maxGaze: 13,
  },
  {
    id: 5,
    name: "Pink Blob",
    cx: 325,
    cy: 425,
    maxGaze: 14,
  },
  {
    id: 6,
    name: "Yellow Blob",
    cx: 485,
    cy: 365,
    maxGaze: 15,
  },
  {
    id: 7,
    name: "Orange Blob",
    cx: 650,
    cy: 430,
    maxGaze: 14,
  },
];

/**
 * Живая интерактивная толпа персонажей (Emoji Crowd):
 * - Плавное слежение взглядом (gaze tracking) за курсором мыши и касанием пальца
 * - Реакция на набор текста: персонажи подаются вперёд и с интересом смотрят на поле ввода
 * - Естественное асинхронное моргание глаз на GPU-композиторе
 * - Органичное индивидуальное дыхание / покачивание каждого персонажа
 * - Интерактивная реакция на нажатие (poke squish wobble) и наведение курсора
 * - Точное сохранение всех размеров, цветов и контуров макета Figma (740×524)
 */
export function EmojiCrowd({
  isTyping = false,
  hasText = false,
  platform = null,
  speech = null,
  onSpeechEnd,
}: EmojiCrowdProps) {
  const crowdRef = useRef<HTMLDivElement>(null);
  const [pokedBlob, setPokedBlob] = useState<number | null>(null);
  // рот бирюзового шевелится, пока облачко печатает реплику
  const [talking, setTalking] = useState(false);

  const hasInput = hasText || isTyping || Boolean(platform);

  useEffect(() => {
    if (!speech) {
      setTalking(false);
      return;
    }
    setTalking(true);
    const timer = setTimeout(() => setTalking(false), Array.from(speech).length * SPEECH_MS_PER_CHAR);
    return () => clearTimeout(timer);
  }, [speech]);

  // Облачко живёт дольше реплики: когда speech убрали, оно ещё доигрывает уход и только потом пропадает
  const [bubble, setBubble] = useState<{ text: string; leaving: boolean } | null>(null);
  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechEndRef.current = onSpeechEnd;
  useEffect(() => {
    if (!speech) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setBubble((b) => (b && !reduced ? { ...b, leaving: true } : null));
      return;
    }
    setBubble({ text: speech, leaving: false });
    // напечаталось и прочитано — просим убрать реплику
    const chars = Array.from(speech).length;
    const timer = setTimeout(
      () => onSpeechEndRef.current?.(),
      chars * (SPEECH_MS_PER_CHAR + SPEECH_READ_MS_PER_CHAR) + SPEECH_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [speech]);

  const isTypingRef = useRef(isTyping);
  const hasTextRef = useRef(hasText);
  const platformRef = useRef(platform);

  useEffect(() => {
    isTypingRef.current = isTyping;
    hasTextRef.current = hasText;
    platformRef.current = platform;
  }, [isTyping, hasText, platform]);

  const REACTION_DURATION_MS = 2000;
  const [reactions, setReactions] = useState<Record<number, BlobReactionState>>({
    0: { variant: 1, isReacting: false, isDead: false },
    1: { variant: 1, isReacting: false, isDead: false },
    2: { variant: 1, isReacting: false, isDead: false },
    3: { variant: 1, isReacting: false, isDead: false },
    4: { variant: 1, isReacting: false, isDead: false },
    5: { variant: 1, isReacting: false, isDead: false },
    6: { variant: 1, isReacting: false, isDead: false },
    7: { variant: 1, isReacting: false, isDead: false },
  });
  const returnTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const deathTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const deadBlobs = useRef<Record<number, number>>({});
  const tapHistory = useRef<Record<number, { count: number; lastTime: number }>>({});
  const lastPoke = useRef<{ id: number; time: number }>({ id: -1, time: 0 });

  const reviveBlob = (id: number) => {
    deadBlobs.current[id] = 0;
    if (deathTimers.current[id]) {
      clearTimeout(deathTimers.current[id]);
      delete deathTimers.current[id];
    }
    // Спокойно возвращаем живое лицо без прыжка
    setReactions((prev) => ({
      ...prev,
      [id]: { variant: 1, isReacting: false, isDead: false },
    }));
  };

  const killBlob = (id: number) => {
    deadBlobs.current[id] = Date.now();
    if (returnTimers.current[id]) {
      clearTimeout(returnTimers.current[id]);
      delete returnTimers.current[id];
    }
    // Мордочка меняется на мёртвую (X_X)
    setReactions((prev) => ({
      ...prev,
      [id]: { variant: 1, isReacting: false, isDead: true },
    }));
    // Держится мёртвым 6 секунд перед тем, как ожить
    if (deathTimers.current[id]) clearTimeout(deathTimers.current[id]);
    deathTimers.current[id] = setTimeout(() => {
      reviveBlob(id);
    }, 6000);
  };

  useEffect(() => {
    return () => {
      Object.values(returnTimers.current).forEach((t) => clearTimeout(t));
      Object.values(deathTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Обработчик интерактивного клика / тыканья по персонажу:
  // если затапать быстро (>=5 раз) — персонаж погибает (X_X)
  const handlePoke = (id: number) => {
    const now = Date.now();
    // Защита от случайного дабл-триггера на тач-устройствах (pointerdown + click в пределах 70ms)
    if (lastPoke.current.id === id && now - lastPoke.current.time < 70) return;
    lastPoke.current = { id, time: now };

    const deadSince = deadBlobs.current[id] || 0;
    if (deadSince > 0) {
      // Защита: пока персонаж мёртв первые 2.5 сек, остаточные спам-клики не могут случайно его воскресить!
      if (now - deadSince < 2500) {
        return;
      }
      // Спустя 2.5 сек осознанный клик может оживить его раньше 6 секунд
      reviveBlob(id);
      tapHistory.current[id] = { count: 0, lastTime: 0 };
      return;
    }

    // Подсчитываем серию быстрых тапов (spam-tap):
    const prevHistory = tapHistory.current[id] ?? { count: 0, lastTime: 0 };
    const streak = now - prevHistory.lastTime < 1300 ? prevHistory.count + 1 : 1;
    tapHistory.current[id] = { count: streak, lastTime: now };

    if (streak >= 5) {
      // Затапали до потери пульса! X_X
      killBlob(id);
      tapHistory.current[id] = { count: 0, lastTime: 0 };
      return;
    }

    setPokedBlob(id);
    setTimeout(() => {
      setPokedBlob((cur) => (cur === id ? null : cur));
    }, 480);

    if (returnTimers.current[id]) {
      clearTimeout(returnTimers.current[id]);
    }

    setReactions((prev) => {
      const cur = prev[id] ?? { variant: 1, isReacting: false, isDead: false, isReviving: false };
      const nextVariant = cur.isReacting ? (cur.variant % 4) + 1 : cur.variant;
      return {
        ...prev,
        [id]: { ...cur, variant: nextVariant, isReacting: true },
      };
    });

    returnTimers.current[id] = setTimeout(() => {
      setReactions((prev) => {
        const cur = prev[id];
        if (!cur || cur.isDead) return prev;
        return {
          ...prev,
          [id]: { ...cur, variant: (cur.variant % 4) + 1, isReacting: false },
        };
      });
    }, REACTION_DURATION_MS);
  };

  useEffect(() => {
    let animFrameId: number;
    let isMoving = false;
    let lastMoveTime = Date.now();
    let mouseX = 0;
    let mouseY = 0;

    // Текущие сглаженные координаты взгляда для каждого из 8 персонажей
    const currentGaze = BLOBS.map(() => ({ x: 0, y: 0 }));

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      isMoving = true;
      lastMoveTime = Date.now();
      if ("touches" in e) {
        if (e.touches.length > 0) {
          mouseX = e.touches[0].clientX;
          mouseY = e.touches[0].clientY;
        }
      } else {
        mouseX = e.clientX;
        mouseY = e.clientY;
      }
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("touchstart", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handlePointerMove, { passive: true });

    const updateGaze = () => {
      if (crowdRef.current) {
        const rect = crowdRef.current.getBoundingClientRect();
        const scale = rect.width / 740;
        const now = Date.now();
        const isIdle = !isMoving || now - lastMoveTime > 3000;
        const platformActive = Boolean(platformRef.current);
        const typingActive = isTypingRef.current;
        const textPresent = hasTextRef.current;

        BLOBS.forEach((blob, i) => {
          let targetX = 0;
          let targetY = 0;

          if (!isIdle) {
            // Пользователь водит мышкой или пальцем — чудики сильнее и выразительнее следят за курсором
            const blobScreenX = rect.left + blob.cx * scale;
            const blobScreenY = rect.top + blob.cy * scale;
            const dx = mouseX - blobScreenX;
            const dy = mouseY - blobScreenY;
            const dist = Math.hypot(dx, dy);

            if (dist > 1) {
              const intensity = Math.min(blob.maxGaze, (dist / 240) * blob.maxGaze);
              targetX = (dx / dist) * intensity;
              targetY = (dy / dist) * intensity;
            }
            if (typingActive) {
              targetX += Math.sin(now * 0.02 + i * 0.5) * 0.8;
            }
          } else if (typingActive || textPresent || platformActive) {
            // Курсор остановился, но пользователь печатает / вставил текст / выбрал платформу:
            // все персонажи внимательно смотрят влево на поле ввода
            const typingPulse = typingActive ? Math.sin(now * 0.015 + i * 0.5) * 1.2 : 0;
            targetX = -blob.maxGaze * 0.94 + typingPulse;
            targetY = 1.8 + typingPulse * 0.4;
          } else {
            // Нежные естественные движения глаз в режиме ожидания (idle glance)
            const time = now * 0.001;
            targetX = Math.sin(time + i * 0.9) * 2.5;
            targetY = Math.cos(time * 0.8 + i * 1.1) * 2;
          }

          // Плавная быстрая интерполяция без задержек (lerp)
          currentGaze[i].x += (targetX - currentGaze[i].x) * 0.15;
          currentGaze[i].y += (targetY - currentGaze[i].y) * 0.15;

          crowdRef.current?.style.setProperty(`--gaze-x-${i}`, `${currentGaze[i].x.toFixed(2)}px`);
          crowdRef.current?.style.setProperty(`--gaze-y-${i}`, `${currentGaze[i].y.toFixed(2)}px`);
        });
      }

      animFrameId = requestAnimationFrame(updateGaze);
    };

    animFrameId = requestAnimationFrame(updateGaze);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchstart", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none relative h-[200px] w-full shrink-0 overflow-hidden sm:h-[250px] md:h-[340px] lg:absolute lg:inset-0 lg:h-auto lg:overflow-visible lg:z-10"
    >
      <div
        ref={crowdRef}
        data-pencil-name="Emoji Crowd"
        className={`box-border w-[740px] h-[524px] absolute left-1/2 bottom-[-70px] -translate-x-1/2 scale-[0.5] sm:scale-[0.62] md:scale-[0.8] origin-bottom lg:left-auto lg:translate-x-0 lg:origin-bottom-right lg:[transform:scale(var(--crowd-scale))] lg:bottom-[calc(-60px*var(--crowd-scale))] transition-all duration-500 ease-out ${
          hasInput
            ? "lg:right-[calc(-80px*var(--crowd-scale))]"
            : "lg:right-[calc(-100px*var(--crowd-scale))]"
        }`}
      >
        {/* ====================================================================
            1. Blue Blob (left: 130px, top: 70px)
           ==================================================================== */}
        <div
          data-pencil-name="Blue Blob"
          onClick={() => handlePoke(0)}
          onPointerDown={() => handlePoke(0)}
          style={{
            animation: pokedBlob === 0 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[240px] h-[240px] absolute left-[130px] top-[70px] bg-[#1660D6] rounded-[120px] [z-index:0] [box-shadow:0px_14px_32px_rgba(22,96,214,0.32),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "translate-x-[-4px]" : ""
          }`}
        >
          {reactions[0]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[0]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-0, 0px), var(--gaze-y-0, 0px), 0)",
            }}
          >
            <BlueFace
              isReacting={reactions[0]?.isReacting ?? false}
              variant={reactions[0]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[0]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            2. Teal Blob (left: 320px, top: 40px)
           ==================================================================== */}
        <div
          data-pencil-name="Teal Blob"
          onClick={() => handlePoke(1)}
          onPointerDown={() => handlePoke(1)}
          style={{
            animation: pokedBlob === 1 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[250px] h-[250px] absolute left-[320px] top-[40px] bg-[#0AA6C2] rounded-[125px] [z-index:1] [box-shadow:0px_14px_32px_rgba(10,166,194,0.35),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "translate-x-[-3px]" : ""
          }`}
        >
          {reactions[1]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[1]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-1, 0px), var(--gaze-y-1, 0px), 0)",
            }}
          >
            <TealFace
              isReacting={reactions[1]?.isReacting ?? false}
              variant={reactions[1]?.variant ?? 1}
              hasText={hasInput}
              talking={talking && !reactions[1]?.isDead}
              isDead={reactions[1]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            3. Green Blob (left: 500px, top: 110px) - правый зелёный
           ==================================================================== */}
        <div
          data-pencil-name="Green Blob"
          onClick={() => handlePoke(2)}
          onPointerDown={() => handlePoke(2)}
          style={{
            animation: pokedBlob === 2 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[190px] h-[190px] absolute left-[500px] top-[110px] bg-[#1DA57A] rounded-[95px] [z-index:2] [box-shadow:0px_14px_32px_rgba(29,165,122,0.35),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "rotate-[-3deg] scale-[1.03]" : ""
          }`}
        >
          {reactions[2]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[2]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-2, 0px), var(--gaze-y-2, 0px), 0)",
            }}
          >
            <GreenFace
              isReacting={reactions[2]?.isReacting ?? false}
              variant={reactions[2]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[2]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            4. Purple Blob (left: 590px, top: 170px)
           ==================================================================== */}
        <div
          data-pencil-name="Purple Blob"
          onClick={() => handlePoke(3)}
          onPointerDown={() => handlePoke(3)}
          style={{
            animation: pokedBlob === 3 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[270px] h-[270px] absolute left-[590px] top-[170px] bg-[#6E1EF0] rounded-[135px] [z-index:3] [box-shadow:0px_14px_32px_rgba(110,30,240,0.32),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "scale-[1.02]" : ""
          }`}
        >
          {reactions[3]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[3]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-3, 0px), var(--gaze-y-3, 0px), 0)",
            }}
          >
            <PurpleFace
              isReacting={reactions[3]?.isReacting ?? false}
              variant={reactions[3]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[3]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            5. Red Blob (left: 20px, top: 240px)
           ==================================================================== */}
        <div
          data-pencil-name="Red Blob"
          onClick={() => handlePoke(4)}
          onPointerDown={() => handlePoke(4)}
          style={{
            animation: pokedBlob === 4 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[240px] h-[240px] absolute left-[20px] top-[240px] bg-[#E2353F] rounded-[120px] [z-index:4] [box-shadow:0px_14px_32px_rgba(226,53,63,0.35),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "rotate-[2deg]" : ""
          }`}
        >
          {reactions[4]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[4]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-4, 0px), var(--gaze-y-4, 0px), 0)",
            }}
          >
            <RedFace
              isReacting={reactions[4]?.isReacting ?? false}
              variant={reactions[4]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[4]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            6. Pink Blob (left: 200px, top: 300px)
           ==================================================================== */}
        <div
          data-pencil-name="Pink Blob"
          onClick={() => handlePoke(5)}
          onPointerDown={() => handlePoke(5)}
          style={{
            animation: pokedBlob === 5 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[250px] h-[250px] absolute left-[200px] top-[300px] bg-[#E0368A] rounded-[125px] [z-index:5] [box-shadow:0px_14px_32px_rgba(224,54,138,0.35),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "scale-[1.02]" : ""
          }`}
        >
          {reactions[5]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[5]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-5, 0px), var(--gaze-y-5, 0px), 0)",
            }}
          >
            <PinkFace
              isReacting={reactions[5]?.isReacting ?? false}
              variant={reactions[5]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[5]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            7. Yellow Blob (left: 370px, top: 250px)
           ==================================================================== */}
        <div
          data-pencil-name="Yellow Blob"
          onClick={() => handlePoke(6)}
          onPointerDown={() => handlePoke(6)}
          style={{
            animation: pokedBlob === 6 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[230px] h-[230px] absolute left-[370px] top-[250px] bg-[#FFC20E] rounded-[115px] [z-index:6] [box-shadow:0px_14px_32px_rgba(255,194,14,0.35),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "scale-[1.04] translate-y-[-4px]" : ""
          }`}
        >
          {reactions[6]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[6]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-6, 0px), var(--gaze-y-6, 0px), 0)",
            }}
          >
            <YellowFace
              isReacting={reactions[6]?.isReacting ?? false}
              variant={reactions[6]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[6]?.isDead ?? false}
            />
          </div>
        </div>

        {/* ====================================================================
            8. Orange Blob (left: 540px, top: 320px)
           ==================================================================== */}
        <div
          data-pencil-name="Orange Blob"
          onClick={() => handlePoke(7)}
          onPointerDown={() => handlePoke(7)}
          style={{
            animation: pokedBlob === 7 ? "blob-poke 0.48s ease-out" : undefined,
          }}
          className={`box-border w-[220px] h-[220px] absolute left-[540px] top-[320px] bg-[#FF7A12] rounded-[110px] [z-index:7] [box-shadow:0px_14px_32px_rgba(255,122,18,0.35),0px_4px_12px_rgba(74,51,51,0.12)] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasInput ? "scale-[1.05]" : ""
          }`}
        >
          {reactions[7]?.isDead && <DeadSkull />}
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out"
            style={{
              transform: reactions[7]?.isDead
                ? "none"
                : "translate3d(var(--gaze-x-7, 0px), var(--gaze-y-7, 0px), 0)",
            }}
          >
            <OrangeFace
              isReacting={reactions[7]?.isReacting ?? false}
              variant={reactions[7]?.variant ?? 1}
              hasText={hasInput}
              isDead={reactions[7]?.isDead ?? false}
            />
          </div>
        </div>

        {/* Плашки с процентами «Ложь / Правда / Спорно» */}
        <FloatingPills />

        {bubble && !reactions[1]?.isDead && (
          <SpeechBubble text={bubble.text} leaving={bubble.leaving} onGone={() => setBubble(null)} />
        )}
      </div>
    </div>
  );
}
