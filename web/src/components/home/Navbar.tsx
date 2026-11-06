import React from "react";
import Link from "next/link";
import { ChevronDown, Github, History } from "lucide-react";
import { GITHUB_URL } from "./HackathonPill";
import { useCabinetText } from "../cabinet/dictionary";
import { usePopover } from "../cabinet/Popover";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import { useSiteText } from "../../i18n/site";

/** «Для редакций» и «Для бизнеса» одним меню: в шапке на два пункта нет места */
function PartnerMenu({ onSelect }: { onSelect: (item: "editorial" | "business") => void }) {
  const t = useSiteText();
  const { open, setOpen, ref } = usePopover();
  const item = (id: "editorial" | "business", label: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onSelect(id);
      }}
      className="block w-full cursor-pointer whitespace-nowrap rounded-[14px] border-none bg-transparent px-3 py-2 text-left text-[15px] font-extrabold text-[#4A3333] hover:bg-[#F1EBE9]"
    >
      {label}
    </button>
  );
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm sm:text-base lg:text-[17px] leading-normal box-border text-[#A27C7A] hover:text-[#4A3333] font-bold text-left whitespace-nowrap transition-colors bg-transparent border-none p-0 cursor-pointer"
      >
        {t.nav.partnering}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+10px)] z-40 rounded-[20px] bg-[#FBF8F7] p-1.5 shadow-[0_10px_30px_#4A333333]"
        >
          {item("editorial", t.nav.editorial)}
          {item("business", t.nav.business)}
        </div>
      )}
    </div>
  );
}

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
        <PartnerMenu onSelect={(item) => onNavClick?.(item)} />

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
