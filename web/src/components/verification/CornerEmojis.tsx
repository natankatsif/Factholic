"use client";

import React, { useEffect, useRef, useState } from "react";

/** Сколько смайлик выглядывает из карточки снизу, px — под это место текст карточки не заходит */
export const CORNER_BLOB_PEEK = 112;

/**
 * Один смайлик в правом нижнем углу карточки «Текст который спросили» (как в макете): выглядывает из-за
 * края, карточка его обрезает (у неё overflow-hidden). Цвет и черты — в стиле home/EmojiCrowd.tsx.
 * Плавно следит взглядом за курсором мыши и касанием, моргает и реагирует на клик.
 */
export function CornerEmojis() {
  const size = 140;
  const blobRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGGElement>(null);
  const [poked, setPoked] = useState(false);

  const handlePoke = () => {
    setPoked(true);
    setTimeout(() => {
      setPoked(false);
    }, 480);
  };

  useEffect(() => {
    let animFrameId: number;
    let isMoving = false;
    let lastMoveTime = Date.now();
    let mouseX = 0;
    let mouseY = 0;

    const currentGaze = { x: 0, y: 0 };

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
      className="absolute select-none pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-[1.04] active:scale-[0.96]"
      style={{
        width: size,
        height: size,
        right: -14,
        bottom: CORNER_BLOB_PEEK - size,
        animation: poked ? "blob-poke 0.48s ease-out" : undefined,
      }}
    >
      <svg
        aria-hidden
        className="h-full w-full pointer-events-none"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="50" fill="#0AA6C2" />
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
        <g ref={mouthRef}>
          <path
            d="M41 52 q4.5 5 9 0 q4.5 5 9 0"
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
