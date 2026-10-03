import React from "react";

export interface NavbarProps {
  onGoHome?: () => void;
  onLogin?: () => void;
  onNavClick?: (item: string) => void;
}

export function Navbar({ onGoHome, onLogin, onNavClick }: NavbarProps) {
  return (
    <header
      data-pencil-name="Top Bar"
      className="box-border w-full h-fit shrink-0 flex flex-row justify-between items-center px-6 sm:px-10 lg:px-20 py-6 lg:py-9 relative z-20"
    >
      {/* Brand Logo */}
      <button
        type="button"
        onClick={onGoHome}
        data-pencil-name="Logo"
        className="text-2xl sm:text-3xl lg:text-[34px] leading-normal box-border text-[#4A3333] font-black tracking-[-1px] text-left whitespace-nowrap bg-transparent border-none p-0 cursor-pointer hover:opacity-90 transition-opacity"
      >
        factholic
      </button>

      {/* Nav Menu and Action */}
      <nav
        data-pencil-name="Nav"
        className="box-border w-fit shrink-0 h-fit flex flex-row gap-5 sm:gap-8 lg:gap-[40px] justify-start items-center"
      >
        <button
          type="button"
          onClick={() => onNavClick?.("how-it-works")}
          className="text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer hidden sm:block"
        >
          Как это работает
        </button>

        <button
          type="button"
          onClick={() => onNavClick?.("sources")}
          className="text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer hidden md:block"
        >
          Источники
        </button>

        <button
          type="button"
          onClick={() => onNavClick?.("editorial")}
          className="text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer hidden lg:block"
        >
          Для редакций
        </button>

        <button
          type="button"
          onClick={onLogin}
          data-pencil-name="Btn Outline"
          className="box-border w-fit shrink-0 h-fit flex flex-row gap-0 px-4 sm:px-5 lg:p-[10px_24px] justify-center items-center rounded-[100px] outline-2 outline-[#4A3333] -outline-offset-1 text-[#4A3333] hover:bg-[#4A3333] hover:text-white transition-all cursor-pointer bg-transparent"
        >
          <span
            data-pencil-name="Btn Text"
            className="text-sm sm:text-base lg:text-[16px] leading-normal box-border font-extrabold text-left whitespace-nowrap"
          >
            Войти
          </span>
        </button>
      </nav>
    </header>
  );
}
