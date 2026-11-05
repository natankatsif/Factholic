import React from "react";
import Link from "next/link";
import { Github, History } from "lucide-react";
import { GITHUB_URL } from "./HackathonPill";
import { useCabinetText } from "../cabinet/dictionary";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import { useSiteText } from "../../i18n/site";

export interface NavbarProps {
  onGoHome?: () => void;
  onLogin?: () => void;
  onNavClick?: (item: string) => void;
  onOpenHistory?: () => void;
}

export function Navbar({ onGoHome, onLogin, onNavClick, onOpenHistory }: NavbarProps) {
  const t = useSiteText();
  const cabinetText = useCabinetText();
  return (
    <header
      data-pencil-name="Top Bar"
      className="box-border w-full max-w-[1440px] mx-auto h-fit shrink-0 flex flex-row justify-between items-center px-6 sm:px-10 lg:px-20 py-4 lg:py-6 relative z-20"
    >
      {/* Brand Logo */}
      <button
        type="button"
        onClick={onGoHome}
        data-pencil-name="Logo"
        title={t.common.toHome}
        className="text-2xl sm:text-3xl lg:text-[32px] leading-normal box-border text-[#4A3333] font-black tracking-[-1px] text-left whitespace-nowrap bg-transparent border-none p-0 cursor-pointer hover:opacity-90 transition-opacity"
      >
        factholic
      </button>

      {/* Nav Menu and Action */}
      <nav
        data-pencil-name="Nav"
        className="box-border w-fit shrink-0 h-fit flex flex-row gap-2.5 sm:gap-5 lg:gap-6 xl:gap-[40px] justify-start items-center"
      >
        <button
          type="button"
          onClick={() => onNavClick?.("editorial")}
          className="text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer hidden lg:block"
        >
          {t.nav.editorial}
        </button>

        <button
          type="button"
          onClick={() => onNavClick?.("business")}
          className="text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer hidden lg:block"
        >
          {t.nav.business}
        </button>

        <Link
          href="/cabinet"
          className="text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors hidden lg:block"
        >
          {cabinetText.nav.cabinet}
        </Link>

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={t.common.history}
            className="flex items-center gap-1.5 text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            <History className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            <span className="hidden sm:inline">{t.common.history}</span>
          </button>
        )}

        <LanguageSwitcher label={t.nav.language} />

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          title={t.nav.github}
          aria-label={t.nav.github}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#A27C7A] transition-colors hover:bg-[#E8DFDC] hover:text-[#4A3333] xl:flex xl:h-10 xl:w-10"
        >
          <Github className="h-[18px] w-[18px] lg:h-5 lg:w-5" strokeWidth={2.2} />
        </a>

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
            {t.nav.login}
          </span>
        </button>
      </nav>
    </header>
  );
}
