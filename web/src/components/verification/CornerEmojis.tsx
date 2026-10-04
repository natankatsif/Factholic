"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ClaimConsensus } from "@news/contracts";
import { clearBlobReturn, markBlobReturn, peekBlobReturn, useHistoryOpen } from "../../lib/history-ui";

/**
 * Настроение чудика — позиция источников по выбранному утверждению; "checking" — ещё проверяется;
 * "history" — улетел к панели истории и с интересом её разглядывает
 */
export type BlobMood = ClaimConsensus | "checking" | "history" | ProgressMood;

/** Эмоции экрана «Анализируем…» по этапам: читает текст, ищет утверждения, ищет источники, всё готово */
export type ProgressMood = "crowd" | "reading" | "claims" | "sources" | "done";

/**
 * Цвет как у статуса в «Разборе», рот и брови — эмоция (viewBox 0..100). Чтобы лицо ПЕРЕТЕКАЛО из одной
 * эмоции в другую, а не заменялось, у всех эмоций одинаковая форма точек:
 *   рот — две кубические кривые: [x0,y0, c1x,c1y, c2x,c2y, x1,y1, c3x,c3y, c4x,c4y, x2,y2];
 *   бровь — квадратичная кривая слева направо: [x0,y0, cx,cy, x1,y1]; brows: 0 — бровей не видно.
 */
interface Face {
  color: string;
  mouth: number[];
  browL: number[];
  browR: number[];
  brows: number;
}

const NO_BROW_L = [31, 30, 37, 30, 43, 30];
const NO_BROW_R = [57, 30, 63, 30, 69, 30];

const MOODS: Record<BlobMood, Face> = {
  // сходятся — довольный «ω»
  converge: {
    color: "#0AA6C2",
    mouth: [41, 52, 42.5, 56.5, 48.5, 56.5, 50, 52, 51.5, 56.5, 57.5, 56.5, 59, 52],
    browL: NO_BROW_L,
    browR: NO_BROW_R,
    brows: 0,
  },
  // разделились — кривая ровная линия, одна бровь вверх: «ну не знаю»
  split: {
    color: "#FFC20E",
    mouth: [42, 55, 44.7, 54.6, 47.3, 54.2, 50, 53.8, 52.7, 53.3, 55.3, 52.9, 58, 52.5],
    browL: [31, 31, 37, 31, 43, 31],
    browR: [57, 29, 63, 25, 69, 28],
    brows: 1,
  },
  // большинство против — грустный: брови домиком, рот дугой вниз
  against: {
    color: "#E2353F",
    mouth: [41, 58, 43, 55, 46, 53.5, 50, 53.5, 54, 53.5, 57, 55, 59, 58],
    browL: [30, 33, 36, 31, 42, 29],
    browR: [58, 29, 64, 31, 70, 33],
    brows: 1,
  },
  // с флагами — удивлённый: брови вверх, рот «о»
  flagged: {
    color: "#FF7A12",
    mouth: [46, 55, 46, 49.5, 54, 49.5, 54, 55, 54, 60.5, 46, 60.5, 46, 55],
    browL: [31, 29, 37, 24, 43, 28],
    browR: [57, 28, 63, 24, 69, 29],
    brows: 1,
  },
  // мало источников — растерянный: волнистый рот, одна бровь вверх
  unverifiable: {
    color: "#A27C7A",
    mouth: [41, 55, 44, 51, 47, 51, 50, 55, 53, 59, 56, 59, 59, 55],
    browL: [31, 31, 37, 31, 43, 31],
    browR: [57, 28, 63, 24, 69, 28],
    brows: 1,
  },
  // смотрит историю — фиолетовый, заинтересованный: мягкая улыбка, брови чуть приподняты
  history: {
    color: "#6E1EF0",
    mouth: [43, 53, 45, 57, 48, 58, 50, 58, 52, 58, 55, 57, 57, 53],
    browL: [31, 29, 37, 26, 43, 29],
    browR: [57, 29, 63, 26, 69, 29],
    brows: 1,
  },
  // бирюзовый из толпы на главной (home/EmojiCrowd, Teal Blob): брови домиком наружу, широкая улыбка
  crowd: {
    color: "#0AA6C2",
    mouth: [41, 48, 41, 52, 45.5, 54.5, 50, 54.5, 54.5, 54.5, 59, 52, 59, 48],
    browL: [31, 28, 37, 27, 43, 26],
    browR: [57, 26, 63, 27, 69, 28],
    brows: 1,
  },
  // экран «Анализируем…»: читает — сосредоточенный, брови чуть сведены, ровный рот
  reading: {
    color: "#0AA6C2",
    mouth: [45, 55, 46.7, 55, 48.3, 55, 50, 55, 51.7, 55, 53.3, 55, 55, 55],
    browL: [31, 30, 37, 31, 43, 32.5],
    browR: [57, 32.5, 63, 31, 69, 30],
    brows: 1,
  },
  // ищет утверждения — скептик: одна бровь вверх, кривая полуулыбка
  claims: {
    color: "#FFC20E",
    mouth: [42, 55, 44.7, 54.6, 47.3, 54.2, 50, 53.8, 52.7, 53.3, 55.3, 52.9, 58, 52.5],
    browL: [31, 31, 37, 31, 43, 31],
    browR: [57, 29, 63, 25, 69, 28],
    brows: 1,
  },
  // ищет источники — внимательный: брови вверх, рот «о»
  sources: {
    color: "#6E1EF0",
    mouth: [46, 55, 46, 49.5, 54, 49.5, 54, 55, 54, 60.5, 46, 60.5, 46, 55],
    browL: [31, 29, 37, 26, 43, 29],
    browR: [57, 29, 63, 26, 69, 29],
    brows: 1,
  },
  // готово — довольный: широкая улыбка
  done: {
    color: "#1DA57A",
    mouth: [38, 52, 41, 60, 46, 62.5, 50, 62.5, 54, 62.5, 59, 60, 62, 52],
    browL: NO_BROW_L,
    browR: NO_BROW_R,
    brows: 0,
  },
  // проверяется — задумчивый: ровный рот
  checking: {
    color: "#0AA6C2",
    mouth: [45, 55, 46.7, 55, 48.3, 55, 50, 55, 51.7, 55, 53.3, 55, 55, 55],
    browL: NO_BROW_L,
    browR: NO_BROW_R,
    brows: 0,
  },
};

/** Все числа лица одним массивом — так их удобно плавно вести к цели */
const faceVector = (f: Face) => [...f.mouth, ...f.browL, ...f.browR, f.brows];
const n = (v: number) => v.toFixed(2);
const mouthPath = (m: number[]) =>
  `M${n(m[0])} ${n(m[1])} C${m.slice(2, 8).map(n).join(" ")} C${m.slice(8, 14).map(n).join(" ")}`;
const browPath = (b: number[]) => `M${n(b[0])} ${n(b[1])} Q${b.slice(2, 6).map(n).join(" ")}`;

/** Сколько смайлик выглядывает из карточки снизу, px — под это место текст карточки не заходит */
export const CORNER_BLOB_PEEK = 112;

const SIZE = 140;
const FLIGHT_MS = 700;
const FLIGHT_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
/** Выезд из-за края карточки: столько добавляется к полёту и такая доля всей анимации */
const EMERGE_MS = 300;
const EMERGE = EMERGE_MS / (FLIGHT_MS + EMERGE_MS);
/** Скругление карточки «Текст который спросили» (rounded-[28px]) — по нему срез в углу */
const CARD_RADIUS = 28;
export const SCREEN_BLOB_PEEK = 88;

type Phase = "home" | "away" | "back";
export type BlobPlacement = "card-corner" | "screen-bottom";

export interface CornerEmojisProps {
  mood?: BlobMood;
  placement?: BlobPlacement;
  peek?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Чудик:
 * - в углу карточки («card-corner», текстовый разбор): выглядывает из угла карточки
 * - снизу экрана поверх всего («screen-bottom», видео-разбор): выглядывает из нижнего края экрана
 * Пока открыта «История» — улетает к её панели, остаётся в той же эмоции и следит за мышкой;
 * панель закрыли — так же плавно возвращается в угол/низ.
 */
export function CornerEmojis({
  mood = "converge",
  placement = "card-corner",
  peek,
  className,
  style,
}: CornerEmojisProps) {
  const isScreenBottom = placement === "screen-bottom";
  const activePeek = peek ?? (isScreenBottom ? SCREEN_BLOB_PEEK : CORNER_BLOB_PEEK);
  const historyOpen = useHistoryOpen();
  // страница сменилась, пока чудик был у истории, — прилетаем в угол оттуда в прежней эмоции (см. markBlobReturn)
  const [returning] = useState(() => (typeof window !== "undefined" ? peekBlobReturn() : null));
  const [phase, setPhase] = useState<Phase>(returning ? "back" : "home");
  const [flyMood, setFlyMood] = useState<BlobMood>(
    returning ? ((returning.mood as BlobMood | undefined) ?? mood) : mood,
  );
  const flyMoodRef = useRef(flyMood);
  flyMoodRef.current = flyMood;
  // прилетаем с экрана анализа — там чудик меньше: стартуем уменьшенным и вырастаем в полёте
  const startScale = useRef(returning?.size ? returning.size / SIZE : 1);
  const anchorRef = useRef<HTMLDivElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  // откуда стартует полёт (место в углу карточки) — первая позиция портала
  const [startRect, setStartRect] = useState<{ left: number; top: number } | null>(() =>
    returning
      ? // портал всегда размера SIZE: ставим его так, чтобы центр совпал с центром чудика-источника
        {
          left: returning.left + (returning.size ?? SIZE) / 2 - SIZE / 2,
          top: returning.top + (returning.size ?? SIZE) / 2 - SIZE / 2,
        }
      : null,
  );

  // Уходим со страницы, пока чудик не дома, — следующий прилетит ровно с его места (даже посреди полёта).
  // Layout-эффект: его очистка идёт до удаления DOM, ref полёта ещё на месте и в нём текущая позиция анимации.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => clearBlobReturn(), []);
  useLayoutEffect(
    () => () => {
      const el = flyRef.current;
      if (phaseRef.current === "home" || !el) return;
      const r = el.getBoundingClientRect();
      markBlobReturn({ left: r.left, top: r.top, mood: flyMoodRef.current });
    },
    [],
  );

  useEffect(() => {
    if (historyOpen && phase !== "away") {
      if (phase === "home" && anchorRef.current) {
        const r = anchorRef.current.getBoundingClientRect();
        setStartRect({ left: r.left, top: r.top });
        setFlyMood(mood);
        fromHome.current = true;
      }
      setPhase("away");
    } else if (!historyOpen && phase === "away") {
      setPhase("back");
    }
  }, [historyOpen, phase, mood]);

  // у истории чудик остаётся в эмоции выбранного утверждения (без фиолетового); прилетел с другой
  // страницы — по пути перетекает из прежней эмоции в новую
  useEffect(() => {
    if (phase !== "home") setFlyMood(mood);
  }, [phase, mood]);

  // полёт начался из угла карточки — сначала выезжаем из-за её края, а не появляемся целиком поверх
  const fromHome = useRef(false);

  useLayoutEffect(() => {
    const el = flyRef.current;
    if (!el || phase === "home") return;
    const target = phase === "away" ? historySpot() : anchorRef.current?.getBoundingClientRect();
    if (!target) return setPhase("home");
    // летим из текущего места (даже если разворот посреди полёта) в цель
    const cur = el.getBoundingClientRect();
    el.getAnimations().forEach((a) => a.cancel());
    el.style.left = `${target.left}px`;
    el.style.top = `${target.top}px`;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const at = (x: number, y: number) => `translate(${x - target.left}px, ${y - target.top}px)`;

    // Сколько чудика дома спрятано за правым и нижним краем карточки: столько он выезжает (или заезжает)
    // по диагонали, а срез по краю карточки (со скруглением угла) едет вместе с ним — край будто неподвижен
    const home = anchorRef.current?.getBoundingClientRect();
    const card = (anchorRef.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const bottomHide = SIZE - activePeek;
    const edge = isScreenBottom
      ? { r: 0, b: bottomHide }
      : home && card
        ? { r: Math.max(0, home.right - card.right), b: Math.max(0, home.bottom - card.bottom) }
        : null;
    const hidden = edge
      ? isScreenBottom
        ? `inset(-80px -80px ${edge.b}px -80px)`
        : `inset(-80px ${edge.r}px ${edge.b}px -80px round 0px 0px ${CARD_RADIUS}px 0px)`
      : null;
    const shown = isScreenBottom
      ? `inset(-80px -80px -80px -80px)`
      : `inset(-80px -80px -80px -80px round 0px 0px ${CARD_RADIUS}px 0px)`;

    let frames: Keyframe[];
    if (phase === "away" && fromHome.current && home && edge && hidden) {
      fromHome.current = false;
      frames = [
        { offset: 0, transform: at(home.left, home.top), clipPath: hidden, easing: "ease-out" },
        {
          offset: EMERGE,
          transform: at(home.left - edge.r, home.top - edge.b),
          clipPath: shown,
          easing: FLIGHT_EASE,
        },
        { offset: 1, transform: "none", clipPath: shown },
      ];
    } else if (phase === "back" && edge && hidden) {
      // первый полёт после экрана анализа — вырастаем из его размера (scale вокруг центра)
      const s0 = startScale.current;
      startScale.current = 1;
      frames = [
        {
          offset: 0,
          transform: `${at(cur.left, cur.top)} scale(${s0})`,
          clipPath: shown,
          easing: FLIGHT_EASE,
        },
        {
          offset: 1 - EMERGE,
          transform: `translate(${-edge.r}px, ${-edge.b}px) scale(1)`,
          clipPath: shown,
          easing: "ease-in",
        },
        // последний кадр совпадает с чудиком дома, обрезанным карточкой, — подмена незаметна
        { offset: 1, transform: "translate(0px, 0px) scale(1)", clipPath: hidden },
      ];
    } else {
      frames = [{ transform: at(cur.left, cur.top) }, { transform: "none" }];
    }
    const anim = el.animate(frames, {
      duration: reduced ? 0 : FLIGHT_MS + (frames.length > 2 ? EMERGE_MS : 0),
      fill: "forwards",
    });
    if (phase === "away") {
      anim.onfinish = () => {
        el.style.clipPath = "none";
      };
    }
    if (phase === "back") anim.onfinish = () => setPhase("home");
  }, [phase, activePeek]);

  const bottomHide = SIZE - activePeek;

  return (
    <>
      {/* место в углу карточки или снизу экрана: дома чудик здесь, в полёте — пусто (по нему меряем, куда возвращаться) */}
      <div
        ref={anchorRef}
        className={`pointer-events-none absolute overflow-visible ${className ?? ""}`}
        style={{
          width: SIZE,
          height: SIZE,
          ...(isScreenBottom
            ? {
                bottom: -bottomHide,
                clipPath: `inset(-80px -80px ${bottomHide}px -80px)`,
              }
            : {
                right: -14,
                bottom: CORNER_BLOB_PEEK - SIZE,
              }),
          ...style,
        }}
      >
        {phase === "home" && <Blob mood={mood} />}
      </div>
      {phase !== "home" &&
        startRect &&
        createPortal(
          <div
            ref={flyRef}
            className="pointer-events-none fixed z-[60] overflow-visible"
            style={{
              width: SIZE,
              height: SIZE,
              left: startRect.left,
              top: startRect.top,
              transformOrigin: "center",
            }}
          >
            <Blob mood={flyMood} />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Куда улетает чудик, пока открыта история: в левый верхний угол экрана, выглядывает из-за края — подальше
 * от панели истории справа. На мобильном панель во весь экран — тогда в её левом верхнем углу.
 */
function historySpot(): { left: number; top: number } {
  return { left: -12, top: -12 };
}

/** Сам чудик: лицо перетекает между эмоциями, глаза следят за мышкой, моргает, реагирует на клик */
export function Blob({ mood, size = SIZE }: { mood: BlobMood; size?: number }) {
  const blobRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGGElement>(null);
  const browsRef = useRef<SVGGElement>(null);
  const [poked, setPoked] = useState(false);

  const handlePoke = () => {
    setPoked(true);
    setTimeout(() => {
      setPoked(false);
    }, 480);
  };

  const face = MOODS[mood] ?? MOODS.converge;
  // к этой цели лицо плавно перетекает в цикле анимации ниже (без перерисовки React)
  const targetFace = useRef(faceVector(face));
  targetFace.current = faceVector(face);
  // в разметке — только начальное лицо: иначе React при смене эмоции сразу выставит конечную форму (рывок)
  const initialFace = useRef(face).current;
  const mouthPathRef = useRef<SVGPathElement>(null);
  const browLRef = useRef<SVGPathElement>(null);
  const browRRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let animFrameId: number;
    let isMoving = false;
    let lastMoveTime = Date.now();
    let mouseX = 0;
    let mouseY = 0;

    const currentGaze = { x: 0, y: 0 };
    const currentFace = [...targetFace.current];

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

    const handlePointerLeave = () => {
      isMoving = false;
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("touchstart", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("mouseleave", handlePointerLeave, { passive: true });

    const updateGaze = () => {
      if (blobRef.current) {
        const rect = blobRef.current.getBoundingClientRect();
        // Центр персонажа в координатах экрана
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const now = Date.now();
        const isIdle = !isMoving || now - lastMoveTime > 4000;

        let targetX = 0;
        let targetY = 0;

        if (!isIdle) {
          const dx = mouseX - cx;
          const dy = mouseY - cy;
          const dist = Math.hypot(dx, dy);

          if (dist > 1) {
            const maxGaze = 8.5; // в единицах viewBox (0..100)
            const intensity = Math.min(maxGaze, (dist / 320) * maxGaze);
            targetX = (dx / dist) * intensity;
            targetY = (dy / dist) * intensity;
          }
        } else {
          // В режиме ожидания слегка посматривает на текст и покачивается
          const time = now * 0.001;
          targetX = -2.5 + Math.sin(time * 0.8) * 1.8;
          targetY = -2.5 + Math.cos(time * 0.6) * 1.4;
        }

        // Плавная интерполяция
        currentGaze.x += (targetX - currentGaze.x) * 0.14;
        currentGaze.y += (targetY - currentGaze.y) * 0.14;

        const gx = currentGaze.x.toFixed(2);
        const gy = currentGaze.y.toFixed(2);
        const mx = (currentGaze.x * 0.68).toFixed(2);
        const my = (currentGaze.y * 0.68).toFixed(2);

        if (eyesRef.current) {
          eyesRef.current.setAttribute("transform", `translate(${gx} ${gy})`);
        }
        browsRef.current?.setAttribute("transform", `translate(${gx} ${gy})`);

        // лицо перетекает к текущей эмоции: ~0,4 с до почти полного совпадения
        const target = targetFace.current;
        for (let i = 0; i < currentFace.length; i++) currentFace[i] += (target[i] - currentFace[i]) * 0.12;
        mouthPathRef.current?.setAttribute("d", mouthPath(currentFace.slice(0, 14)));
        browLRef.current?.setAttribute("d", browPath(currentFace.slice(14, 20)));
        browRRef.current?.setAttribute("d", browPath(currentFace.slice(20, 26)));
        browsRef.current?.setAttribute("opacity", currentFace[26].toFixed(3));
        if (mouthRef.current) {
          mouthRef.current.setAttribute("transform", `translate(${mx} ${my})`);
        }
      }

      animFrameId = requestAnimationFrame(updateGaze);
    };

    animFrameId = requestAnimationFrame(updateGaze);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchstart", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  return (
    <div
      ref={blobRef}
      onClick={handlePoke}
      onPointerDown={handlePoke}
      role="button"
      tabIndex={-1}
      aria-label="Интерактивный персонаж"
      data-mood={mood}
      className="relative select-none pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-[1.04] active:scale-[0.96]"
      style={{
        width: size,
        height: size,
        animation: poked ? "blob-poke 0.48s ease-out" : undefined,
      }}
    >
      <svg aria-hidden className="h-full w-full pointer-events-none" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" style={{ fill: face.color, transition: "fill 500ms ease" }} />
        <g ref={eyesRef}>
          <circle
            cx="37"
            cy="40"
            r="5.5"
            fill="#00000073"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "eye-blink-1 4.4s infinite ease-in-out",
            }}
          />
          <circle
            cx="63"
            cy="40"
            r="5.5"
            fill="#00000073"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "eye-blink-1 4.4s infinite ease-in-out",
            }}
          />
        </g>
        {/* брови двигаются вместе с глазами */}
        <g ref={browsRef} opacity={initialFace.brows}>
          <path
            ref={browLRef}
            d={browPath(initialFace.browL)}
            fill="none"
            stroke="#00000073"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            ref={browRRef}
            d={browPath(initialFace.browR)}
            fill="none"
            stroke="#00000073"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
        <g ref={mouthRef}>
          <path
            ref={mouthPathRef}
            d={mouthPath(initialFace.mouth)}
            fill="none"
            stroke="#00000073"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
