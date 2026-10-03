import React from "react";

export interface VerificationHeaderProps {
  onGoHome?: () => void;
}

/** Шапка экрана разбора по макету: логотип, «История», «Источники», аватар. */
export function VerificationHeader({ onGoHome }: VerificationHeaderProps) {
  return (
    <header className="flex h-[64px] w-full shrink-0 items-center justify-between px-4 sm:px-8 lg:h-[70px]">
      <button
        type="button"
        onClick={onGoHome}
        title="На главную"
        className="cursor-pointer border-none bg-transparent p-0 text-[24px] font-black tracking-[-1px] text-[#4A3333] transition-opacity hover:opacity-80 sm:text-[28px]"
      >
        factholic
      </button>

      <div className="flex items-center gap-5 sm:gap-7">
        {/* TODO(frontend): страницы «История» и «Источники» */}
        <nav className="flex items-center gap-5 text-sm font-bold text-[#A27C7A] sm:gap-7 sm:text-[15px]">
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent p-0 hover:text-[#4A3333]"
          >
            История
          </button>
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent p-0 hover:text-[#4A3333]"
          >
            Источники
          </button>
        </nav>
        {/* TODO(frontend): инициал из профиля, когда будет авторизация */}
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#0AA6C2] text-[15px] font-black text-white">
          Н
        </div>
      </div>
    </header>
  );
}
