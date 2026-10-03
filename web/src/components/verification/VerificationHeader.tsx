"use client";

import React, { useState } from "react";
import { History } from "lucide-react";
import { HistoryDrawer } from "../history/HistoryDrawer";

export interface VerificationHeaderProps {
  onGoHome?: () => void;
  currentJobId?: string;
}

/**
 * Шапка экрана разбора:
 * Откалибрована по сетке главной страницы (max-w-[1440px], px-6 sm:px-10 lg:px-20).
 * Логотип factholic идентичен главной.
 * «Источники» убраны по запросу.
 * «История» открывает боковую панель с историей проверок.
 */
export function VerificationHeader({ onGoHome, currentJobId }: VerificationHeaderProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  return (
    <>
      <header
        data-pencil-name="Top Bar"
        className="box-border w-full max-w-[1440px] mx-auto h-fit shrink-0 flex flex-row justify-between items-center px-6 sm:px-10 lg:px-20 py-4 lg:py-6 relative z-20"
      >
        {/* Brand Logo */}
        <button
          type="button"
          onClick={onGoHome}
          data-pencil-name="Logo"
          title="На главную"
          className="text-2xl sm:text-3xl lg:text-[32px] leading-normal box-border text-[#4A3333] font-black tracking-[-1px] text-left whitespace-nowrap bg-transparent border-none p-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          factholic
        </button>

        {/* Nav Actions: История + Профиль */}
        <div className="flex items-center gap-5 sm:gap-7">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 cursor-pointer border-none bg-transparent p-0 text-sm sm:text-base lg:text-[17px] font-bold text-[#A27C7A] hover:text-[#4A3333] transition-colors"
          >
            <History className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            <span>История</span>
          </button>

          {/* User Profile Avatar */}
          <div
            title="Профиль"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#0AA6C2] text-[15px] font-black text-white shadow-xs cursor-default select-none"
          >
            Н
          </div>
        </div>
      </header>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentJobId={currentJobId}
      />
    </>
  );
}
