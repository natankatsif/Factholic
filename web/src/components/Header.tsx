import React from "react";
import { History, Library, Sparkles, BookOpen } from "lucide-react";

interface HeaderProps {
  onNewCheck?: () => void;
  activeScreen?: "screen1" | "screen2";
  onGoToScreen1?: () => void;
}

export function Header({ onNewCheck, activeScreen, onGoToScreen1 }: HeaderProps) {
  return (
    <header className="w-full bg-[#F1EBE9] border-b border-stone-200/80 px-6 py-3 flex items-center justify-between">
      {/* Brand logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onGoToScreen1}
          className="flex items-center gap-2 group text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-purple-800 transition-colors">
            f
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-stone-900 group-hover:text-purple-900 transition-colors">
              factholic
            </span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              web
            </span>
          </div>
        </button>

        {activeScreen === "screen2" && onGoToScreen1 && (
          <button
            onClick={onGoToScreen1}
            className="text-xs font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-md transition-colors"
          >
            ← К разбору
          </button>
        )}
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-3">
        {onNewCheck && (
          <button
            onClick={onNewCheck}
            className="flex items-center gap-1.5 text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 px-3 py-1.5 rounded-md shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            Проверить текст
          </button>
        )}

        <div className="h-4 w-px bg-stone-300 mx-1 hidden sm:block" />

        <button className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-200/50 transition-colors">
          <History className="w-3.5 h-3.5" />
          <span>История</span>
        </button>

        <button className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-200/50 transition-colors">
          <Library className="w-3.5 h-3.5" />
          <span>Источники</span>
        </button>

        <button className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-200/50 transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Как это работает</span>
        </button>

        <div className="w-7 h-7 rounded-full bg-stone-800 text-stone-100 flex items-center justify-center text-xs font-semibold shadow-sm ml-1">
          Н
        </div>
      </div>
    </header>
  );
}
