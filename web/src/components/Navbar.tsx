import React from "react";

interface NavbarProps {
  onGoHome?: () => void;
  onLogin?: () => void;
}

export function Navbar({ onGoHome, onLogin }: NavbarProps) {
  return (
    <nav className="w-full flex flex-row justify-between items-center px-6 sm:px-12 lg:px-20 py-6 sm:py-8 z-20 shrink-0">
      <button
        type="button"
        onClick={onGoHome}
        className="text-[34px] leading-normal text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap cursor-pointer bg-transparent border-none p-0 hover:opacity-90 transition-opacity"
      >
        factholic
      </button>

      <div className="flex flex-row items-center gap-6 sm:gap-10">
        <button
          type="button"
          className="text-[17px] leading-normal text-[#A27C7A] hover:text-[#4A3333] font-bold whitespace-nowrap hidden sm:block transition-colors cursor-pointer bg-transparent border-none p-0"
        >
          Как это работает
        </button>
        <button
          type="button"
          className="text-[17px] leading-normal text-[#A27C7A] hover:text-[#4A3333] font-bold whitespace-nowrap hidden md:block transition-colors cursor-pointer bg-transparent border-none p-0"
        >
          Источники
        </button>
        <button
          type="button"
          className="text-[17px] leading-normal text-[#A27C7A] hover:text-[#4A3333] font-bold whitespace-nowrap hidden lg:block transition-colors cursor-pointer bg-transparent border-none p-0"
        >
          Для редакций
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="px-6 py-2.5 sm:py-3 outline-2 outline-[#4A3333] -outline-offset-1 rounded-full text-[17px] leading-normal text-[#4A3333] hover:bg-[#4A3333] hover:text-white font-bold transition-all whitespace-nowrap cursor-pointer bg-transparent"
        >
          Войти
        </button>
      </div>
    </nav>
  );
}
