"use client";

import React, { useEffect, useRef, useState } from "react";
import { FloatingPills } from "./FloatingPills";

export interface EmojiCrowdProps {
  isTyping?: boolean;
  hasText?: boolean;
}

/**
 * Центры каждого персонажа в системе координат толпы (740×524)
 * и максимальный радиус смещения взгляда с учётом глубины слоя (параллакс).
 */
const BLOBS = [
  { id: 0, name: "Blue Blob", cx: 250, cy: 190, maxGaze: 6, breathe: "blob-breathe-1 4.4s ease-in-out infinite" },
  { id: 1, name: "Teal Blob", cx: 445, cy: 165, maxGaze: 6, breathe: "blob-breathe-2 3.8s ease-in-out infinite" },
  { id: 2, name: "Green Blob", cx: 595, cy: 205, maxGaze: 8, breathe: "blob-breathe-3 4.6s ease-in-out infinite" },
  { id: 3, name: "Purple Blob", cx: 725, cy: 305, maxGaze: 8, breathe: "blob-breathe-4 4.8s ease-in-out infinite 0.5s" },
  { id: 4, name: "Red Blob", cx: 140, cy: 360, maxGaze: 9, breathe: "blob-breathe-1 3.4s ease-in-out infinite 0.2s" },
  { id: 5, name: "Pink Blob", cx: 325, cy: 425, maxGaze: 10, breathe: "blob-breathe-2 4.1s ease-in-out infinite 1.0s" },
  { id: 6, name: "Yellow Blob", cx: 485, cy: 365, maxGaze: 10, breathe: "blob-breathe-3 3.5s ease-in-out infinite 0.4s" },
  { id: 7, name: "Orange Blob", cx: 650, cy: 430, maxGaze: 10, breathe: "blob-breathe-4 3.9s ease-in-out infinite 1.2s" },
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
export function EmojiCrowd({ isTyping = false, hasText = false }: EmojiCrowdProps) {
  const crowdRef = useRef<HTMLDivElement>(null);
  const [pokedBlob, setPokedBlob] = useState<number | null>(null);

  const isTypingRef = useRef(isTyping);
  const hasTextRef = useRef(hasText);

  useEffect(() => {
    isTypingRef.current = isTyping;
    hasTextRef.current = hasText;
  }, [isTyping, hasText]);

  // Обработчик интерактивного клика / тыканья по персонажу
  const handlePoke = (id: number) => {
    setPokedBlob(id);
    setTimeout(() => {
      setPokedBlob((cur) => (cur === id ? null : cur));
    }, 480);
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
        const isIdle = !isMoving || now - lastMoveTime > 4500;
        const typingActive = isTypingRef.current;
        const textPresent = hasTextRef.current;

        BLOBS.forEach((blob, i) => {
          let targetX = 0;
          let targetY = 0;

          if (typingActive || textPresent) {
            // Когда пользователь печатает или есть текст в поле:
            // все персонажи поворачивают взгляд влево к полю ввода с живым лёгким микродвижением
            const typingPulse = typingActive ? Math.sin(now * 0.015 + i * 0.5) * 0.8 : 0;
            targetX = -blob.maxGaze * 0.92 + typingPulse;
            targetY = 1.6 + typingPulse * 0.4;
          } else if (!isIdle) {
            // Центр персонажа в координатах экрана
            const blobScreenX = rect.left + blob.cx * scale;
            const blobScreenY = rect.top + blob.cy * scale;
            const dx = mouseX - blobScreenX;
            const dy = mouseY - blobScreenY;
            const dist = Math.hypot(dx, dy);

            if (dist > 1) {
              const intensity = Math.min(blob.maxGaze, (dist / 400) * blob.maxGaze);
              targetX = (dx / dist) * intensity;
              targetY = (dy / dist) * intensity;
            }
          } else {
            // Нежные естественные движения глаз в режиме ожидания (idle glance)
            const time = now * 0.001;
            targetX = Math.sin(time + i * 0.9) * 2;
            targetY = Math.cos(time * 0.8 + i * 1.1) * 1.5;
          }

          // Плавная интерполяция (lerp)
          currentGaze[i].x += (targetX - currentGaze[i].x) * 0.12;
          currentGaze[i].y += (targetY - currentGaze[i].y) * 0.12;

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
      className="pointer-events-none relative h-[200px] w-full shrink-0 overflow-hidden sm:h-[250px] md:h-[340px] lg:absolute lg:inset-0 lg:h-auto lg:overflow-visible"
    >
      <div
        ref={crowdRef}
        data-pencil-name="Emoji Crowd"
        className={`box-border w-[740px] h-[524px] absolute left-1/2 bottom-[-70px] -translate-x-1/2 scale-[0.5] sm:scale-[0.62] md:scale-[0.8] origin-bottom lg:left-auto lg:translate-x-0 lg:origin-bottom-right lg:[transform:scale(var(--crowd-scale))] lg:bottom-[calc(-60px*var(--crowd-scale))] transition-all duration-500 ease-out ${
          hasText || isTyping
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
          style={{
            animation: pokedBlob === 0 ? "blob-poke 0.48s ease-out" : BLOBS[0].breathe,
          }}
          className={`box-border w-[240px] h-[240px] absolute left-[130px] top-[70px] bg-[#1660D6] rounded-[120px] [z-index:0] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "translate-x-[-4px]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-0, 0px), var(--gaze-y-0, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Brow L"
              className={`box-border w-[48px] h-[12px] [transform:rotate(-15deg)] [transform-origin:top_left] absolute left-[48px] top-[72px] bg-[#00000059] rounded-[6px] [z-index:0] transition-transform duration-300 ${
                hasText ? "-translate-y-1" : ""
              }`}
            />
            <div
              data-pencil-name="Brow R"
              className={`box-border w-[48px] h-[12px] [transform:rotate(15deg)] [transform-origin:top_left] absolute left-[144px] top-[72px] bg-[#00000059] rounded-[6px] [z-index:1] transition-transform duration-300 ${
                hasText ? "-translate-y-1" : ""
              }`}
            />
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-1 4.4s infinite ease-in-out" }}
              className="box-border w-[24px] h-[36px] absolute left-[60px] top-[96px] bg-[#00000059] rounded-full [z-index:2] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-1 4.4s infinite ease-in-out" }}
              className="box-border w-[24px] h-[36px] absolute left-[156px] top-[96px] bg-[#00000059] rounded-full [z-index:3] origin-center"
            />
            <div
              data-pencil-name="Mouth"
              className="box-border w-[60px] h-[24px] absolute left-[90px] top-[156px] bg-[#00000059] rounded-[12px] [z-index:4]"
            />
          </div>
        </div>

        {/* ====================================================================
            2. Teal Blob (left: 320px, top: 40px)
           ==================================================================== */}
        <div
          data-pencil-name="Teal Blob"
          onClick={() => handlePoke(1)}
          style={{
            animation: pokedBlob === 1 ? "blob-poke 0.48s ease-out" : BLOBS[1].breathe,
          }}
          className={`box-border w-[250px] h-[250px] absolute left-[320px] top-[40px] bg-[#1DA57A] rounded-[125px] [z-index:1] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "translate-x-[-3px]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-1, 0px), var(--gaze-y-1, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Brow L"
              className="box-border w-[39.6px] h-[11px] [transform:rotate(-10deg)] [transform-origin:top_left] absolute left-[63.8px] top-[48.4px] bg-[#00000059] rounded-[5.5px] [z-index:0]"
            />
            <div
              data-pencil-name="Brow R"
              className="box-border w-[39.6px] h-[11px] [transform:rotate(10deg)] [transform-origin:top_left] absolute left-[143px] top-[48.4px] bg-[#00000059] rounded-[5.5px] [z-index:1]"
            />
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-2 3.9s infinite ease-in-out 0.8s" }}
              className="box-border w-[17.6px] h-[26.4px] absolute left-[74.8px] top-[70.4px] bg-[#00000059] rounded-full [z-index:2] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-2 3.9s infinite ease-in-out 0.8s" }}
              className="box-border w-[17.6px] h-[26.4px] absolute left-[151.8px] top-[70.4px] bg-[#00000059] rounded-full [z-index:3] origin-center"
            />
            {/* Единственная ровная центрированная улыбка */}
            <svg
              data-pencil-name="Mouth"
              viewBox="0 0 48 24"
              fill="none"
              className={`box-border w-[48px] h-[24px] absolute left-[101px] top-[98px] text-[#00000059] [z-index:2] transition-transform duration-300 ${
                hasText ? "scale-[1.08]" : ""
              }`}
            >
              <path
                d="M4 6C4 16 12.954 20 24 20C35.046 20 44 16 44 6"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* ====================================================================
            3. Green Blob (left: 500px, top: 110px) - правый зелёный
           ==================================================================== */}
        <div
          data-pencil-name="Green Blob"
          onClick={() => handlePoke(2)}
          style={{
            animation: pokedBlob === 2 ? "blob-poke 0.48s ease-out" : BLOBS[2].breathe,
          }}
          className={`box-border w-[190px] h-[190px] absolute left-[500px] top-[110px] bg-[#1DA57A] rounded-[95px] [z-index:2] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "rotate-[-3deg] scale-[1.03]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-2, 0px), var(--gaze-y-2, 0px), 0)",
            }}
          >
            {/* Симметричные левый и правый глаз (без дублирующего глаза) */}
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-squint 5.2s infinite ease-in-out 1.2s" }}
              className="box-border w-[30.4px] h-[8.55px] [transform:rotate(25deg)] [transform-origin:top_left] absolute left-[38px] top-[68.4px] bg-[#00000059] rounded-[4.275px] [z-index:0] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-squint 5.2s infinite ease-in-out 1.2s" }}
              className="box-border w-[30.4px] h-[8.55px] [transform:rotate(-25deg)] [transform-origin:top_left] absolute left-[110px] top-[56px] bg-[#00000059] rounded-[4.275px] [z-index:1] origin-center"
            />
            <div
              data-pencil-name="Mouth"
              className="box-border w-[68.4px] h-[9.5px] [transform:rotate(-15deg)] [transform-origin:top_left] absolute left-[60.8px] top-[114px] bg-[#00000059] rounded-[4.75px] [z-index:3]"
            />
          </div>
        </div>

        {/* ====================================================================
            4. Purple Blob (left: 590px, top: 170px)
           ==================================================================== */}
        <div
          data-pencil-name="Purple Blob"
          onClick={() => handlePoke(3)}
          style={{
            animation: pokedBlob === 3 ? "blob-poke 0.48s ease-out" : BLOBS[3].breathe,
          }}
          className={`box-border w-[270px] h-[270px] absolute left-[590px] top-[170px] bg-[#6E1EF0] rounded-[135px] [z-index:3] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "scale-[1.02]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-3, 0px), var(--gaze-y-3, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Brow L"
              className="box-border w-[43.2px] h-[12.15px] [transform:rotate(-25deg)] [transform-origin:top_left] absolute left-[75.6px] top-[54px] bg-[#00000059] rounded-[6.075px] [z-index:0]"
            />
            <div
              data-pencil-name="Brow R"
              className="box-border w-[43.2px] h-[12.15px] [transform:rotate(25deg)] [transform-origin:top_left] absolute left-[151.2px] top-[54px] bg-[#00000059] rounded-[6.075px] [z-index:1]"
            />
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-3 5.5s infinite ease-in-out 2.0s" }}
              className="box-border w-[27px] h-[40.5px] absolute left-[81px] top-[81px] bg-[#00000059] rounded-full [z-index:2] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-3 5.5s infinite ease-in-out 2.0s" }}
              className="box-border w-[27px] h-[40.5px] absolute left-[156.6px] top-[81px] bg-[#00000059] rounded-full [z-index:3] origin-center"
            />
            <div
              data-pencil-name="Mouth"
              className="box-border w-[64.8px] h-[43.2px] absolute left-[102.6px] top-[140.4px] bg-[#00000059] [clip-path:path('M64.8_21.6_C64.8_9.671_50.294_0_32.4_0_C14.506_0_0_9.671_0_21.6_L7.128_21.6_C7.128_12.295_18.443_4.752_32.4_4.752_C46.357_4.752_57.672_12.295_57.672_21.6_L64.8_21.6_Z')] [z-index:4]"
            />
          </div>
        </div>

        {/* ====================================================================
            5. Red Blob (left: 20px, top: 240px)
           ==================================================================== */}
        <div
          data-pencil-name="Red Blob"
          onClick={() => handlePoke(4)}
          style={{
            animation: pokedBlob === 4 ? "blob-poke 0.48s ease-out" : BLOBS[4].breathe,
          }}
          className={`box-border w-[240px] h-[240px] absolute left-[20px] top-[240px] bg-[#E2353F] rounded-[120px] [z-index:4] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "rotate-[2deg]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-4, 0px), var(--gaze-y-4, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Brow L"
              className={`box-border w-[48px] h-[12px] [transform:rotate(18deg)] [transform-origin:top_left] absolute left-[52.8px] top-[72px] bg-[#00000059] rounded-[6px] [z-index:0] transition-transform duration-300 ${
                hasText ? "-translate-y-1" : ""
              }`}
            />
            <div
              data-pencil-name="Brow R"
              className={`box-border w-[48px] h-[12px] [transform:rotate(-18deg)] [transform-origin:top_left] absolute left-[139.2px] top-[86.4px] bg-[#00000059] rounded-[6px] [z-index:1] transition-transform duration-300 ${
                hasText ? "-translate-y-1" : ""
              }`}
            />
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-4 3.7s infinite ease-in-out 0.5s" }}
              className="box-border w-[21.6px] h-[21.6px] absolute left-[72px] top-[96px] bg-[#00000059] rounded-full [z-index:2] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-4 3.7s infinite ease-in-out 0.5s" }}
              className="box-border w-[21.6px] h-[21.6px] absolute left-[144px] top-[96px] bg-[#00000059] rounded-full [z-index:3] origin-center"
            />
            <div
              data-pencil-name="Mouth"
              className="box-border w-[67.2px] h-[12px] absolute left-[86.4px] top-[144px] bg-[#00000059] rounded-[6px] [z-index:4]"
            />
          </div>
        </div>

        {/* ====================================================================
            6. Pink Blob (left: 200px, top: 300px)
           ==================================================================== */}
        <div
          data-pencil-name="Pink Blob"
          onClick={() => handlePoke(5)}
          style={{
            animation: pokedBlob === 5 ? "blob-poke 0.48s ease-out" : BLOBS[5].breathe,
          }}
          className={`box-border w-[250px] h-[250px] absolute left-[200px] top-[300px] bg-[#E0368A] rounded-[125px] [z-index:5] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "scale-[1.02]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-5, 0px), var(--gaze-y-5, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-1 4.3s infinite ease-in-out 1.5s" }}
              className="box-border w-[25px] h-[42.5px] absolute left-[75px] top-[75px] bg-[#00000059] rounded-full [z-index:0] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-1 4.3s infinite ease-in-out 1.5s" }}
              className="box-border w-[25px] h-[42.5px] absolute left-[150px] top-[75px] bg-[#00000059] rounded-full [z-index:1] origin-center"
            />
            <div
              data-pencil-name="Mouth"
              className="box-border w-[85px] h-[12.5px] absolute left-[82.5px] top-[155px] bg-[#00000059] rounded-[6.25px] [z-index:2]"
            />
          </div>
        </div>

        {/* ====================================================================
            7. Yellow Blob (left: 370px, top: 250px)
           ==================================================================== */}
        <div
          data-pencil-name="Yellow Blob"
          onClick={() => handlePoke(6)}
          style={{
            animation: pokedBlob === 6 ? "blob-poke 0.48s ease-out" : BLOBS[6].breathe,
          }}
          className={`box-border w-[230px] h-[230px] absolute left-[370px] top-[250px] bg-[#FFC20E] rounded-[115px] [z-index:6] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "scale-[1.04] translate-y-[-4px]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-6, 0px), var(--gaze-y-6, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-2 3.6s infinite ease-in-out 2.2s" }}
              className="box-border w-[23px] h-[36.8px] absolute left-[69px] top-[69px] bg-[#00000059] rounded-full [z-index:0] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-2 3.6s infinite ease-in-out 2.2s" }}
              className="box-border w-[23px] h-[36.8px] absolute left-[138px] top-[69px] bg-[#00000059] rounded-full [z-index:1] origin-center"
            />
            <div
              data-pencil-name="Smile"
              className={`box-border w-[101.2px] h-[69px] absolute left-[64.4px] top-[101.2px] bg-[#00000059] [clip-path:path('M0_34.5_C0_53.554_22.654_69_50.6_69_C78.546_69_101.2_53.554_101.2_34.5_L92.092_34.5_C92.092_50.124_73.515_62.79_50.6_62.79_C27.685_62.79_9.108_50.124_9.108_34.5_L0_34.5_Z')] [z-index:2] transition-transform duration-300 ${
                hasText ? "scale-[1.06]" : ""
              }`}
            />
          </div>
        </div>

        {/* ====================================================================
            8. Orange Blob (left: 540px, top: 320px)
           ==================================================================== */}
        <div
          data-pencil-name="Orange Blob"
          onClick={() => handlePoke(7)}
          style={{
            animation: pokedBlob === 7 ? "blob-poke 0.48s ease-out" : BLOBS[7].breathe,
          }}
          className={`box-border w-[220px] h-[220px] absolute left-[540px] top-[320px] bg-[#FF7A12] rounded-[110px] [z-index:7] pointer-events-auto cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-[0.96] ${
            hasText ? "scale-[1.05]" : ""
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: "translate3d(var(--gaze-x-7, 0px), var(--gaze-y-7, 0px), 0)",
            }}
          >
            <div
              data-pencil-name="Brow L"
              className={`box-border w-[35.2px] h-[22px] absolute left-[57.2px] top-[39.6px] bg-[#00000059] [clip-path:path('M35.2_11_C35.2_4.925_27.32_0_17.6_0_C7.88_0_0_4.925_0_11_L5.28_11_C5.28_6.747_10.796_3.3_17.6_3.3_C24.404_3.3_29.92_6.747_29.92_11_L35.2_11_Z')] [z-index:0] transition-transform duration-300 ${
                hasText ? "-translate-y-1.5" : ""
              }`}
            />
            <div
              data-pencil-name="Brow R"
              className={`box-border w-[35.2px] h-[22px] absolute left-[127.6px] top-[39.6px] bg-[#00000059] [clip-path:path('M35.2_11_C35.2_4.925_27.32_0_17.6_0_C7.88_0_0_4.925_0_11_L5.28_11_C5.28_6.747_10.796_3.3_17.6_3.3_C24.404_3.3_29.92_6.747_29.92_11_L35.2_11_Z')] [z-index:1] transition-transform duration-300 ${
                hasText ? "-translate-y-1.5" : ""
              }`}
            />
            <div
              data-pencil-name="Eye L"
              style={{ animation: "eye-blink-3 4.1s infinite ease-in-out 0.7s" }}
              className="box-border w-[17.6px] h-[26.4px] absolute left-[66px] top-[70.4px] bg-[#00000059] rounded-full [z-index:2] origin-center"
            />
            <div
              data-pencil-name="Eye R"
              style={{ animation: "eye-blink-3 4.1s infinite ease-in-out 0.7s" }}
              className="box-border w-[17.6px] h-[26.4px] absolute left-[136.4px] top-[70.4px] bg-[#00000059] rounded-full [z-index:3] origin-center"
            />
            <div
              data-pencil-name="Mouth"
              className={`box-border w-[26.4px] h-[30.8px] absolute left-[96.8px] top-[114.4px] bg-[#00000059] rounded-full [z-index:4] transition-transform duration-300 origin-center ${
                hasText ? "scale-[1.25]" : ""
              }`}
            />
          </div>
        </div>

        {/* Плашки с процентами «Ложь / Правда / Спорно» */}
        <FloatingPills />
      </div>
    </div>
  );
}
