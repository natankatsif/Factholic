import React from "react";
import { ArrowLeft, Sparkles, BookOpen, Library, History } from "lucide-react";

interface HeaderProps {
  onGoHome: () => void;
  onNewCheck?: () => void;
  activeScreen?: "home" | "screen1" | "screen2";
  onGoToScreen1?: () => void;
}

export function Header({
  onGoHome,
  onNewCheck,
  activeScreen,
  onGoToScreen1,
}: HeaderProps) {
  return (
    <header className="w-full bg-[#F1EBE9] border-b border-[#E3D9D6] px-6 sm:px-12 py-3 flex items-center justify-between z-20">
      {/* Brand logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 group text-left cursor-pointer"
        >
          <span className="text-[26px] text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap">
            factholic
          </span>
          <span className="text-2xs font-extrabold px-2 py-0.5 rounded-full bg-[#4A3333] text-white">
            web
          </span>
        </button>

        {activeScreen === "screen2" && onGoToScreen1 && (
          <button
            onClick={onGoToScreen1}
            className="text-xs font-bold text-[#4A3333] hover:text-black flex items-center gap-1 bg-white hover:bg-stone-100 px-3 py-1.5 rounded-full border border-[#E3D9D6] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />К разбору
          </button>
        )}

        {activeScreen === "screen1" && (
          <button
            onClick={onGoHome}
            className="text-xs font-bold text-[#4A3333] hover:text-black flex items-center gap-1 bg-white hover:bg-stone-100 px-3 py-1.5 rounded-full border border-[#E3D9D6] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />На главную
          </button>
        )}
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-3">
        {onNewCheck && (
          <button
            onClick={onNewCheck}
            className="flex items-center gap-1.5 text-xs font-extrabold bg-[#4A3333] text-white hover:bg-[#382525] px-3.5 py-1.5 rounded-full shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Новая проверка
          </button>
        )}

        <div className="h-4 w-px bg-[#E3D9D6] mx-1 hidden sm:block" />

        <button
          onClick={onGoHome}
          className="flex items-center gap-1.5 text-xs font-bold text-[#A27C7A] hover:text-[#4A3333] px-2 py-1 rounded transition-colors hidden sm:flex cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Как это работает</span>
        </button>

        <button className="flex items-center gap-1.5 text-xs font-bold text-[#A27C7A] hover:text-[#4A3333] px-2 py-1 rounded transition-colors hidden md:flex cursor-pointer">
          <Library className="w-3.5 h-3.5" />
          <span>Источники</span>
        </button>

        <button className="flex items-center gap-1.5 text-xs font-bold text-[#A27C7A] hover:text-[#4A3333] px-2 py-1 rounded transition-colors hidden lg:flex cursor-pointer">
          <History className="w-3.5 h-3.5" />
          <span>История</span>
        </button>

        <div className="w-7 h-7 rounded-full bg-[#4A3333] text-white flex items-center justify-center text-xs font-black shadow-xs ml-1">
          Н
        </div>
      </div>
    </header>
  );
}
