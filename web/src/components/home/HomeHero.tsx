"use client";

import React, { useState } from "react";
import { Navbar } from "./Navbar";
import { HeroHeadline } from "./HeroHeadline";
import { LinkInputCard } from "./LinkInputCard";
import { SupportedPlatforms } from "./SupportedPlatforms";
import { HowItWorks } from "./HowItWorks";
import { EmojiCrowd } from "./EmojiCrowd";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { X, Building2, UserCheck } from "lucide-react";

export interface HomeHeroProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
}

/**
 * Главная по макету «Home — Paste Link» (1440×1024).
 * Откалибрована по общей дизайн-системе factholic.
 */
export function HomeHero({ onCheck, isLoading }: HomeHeroProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditorialOpen, setIsEditorialOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleTypingChange = (typing: boolean, text: string) => {
    setIsTyping(typing);
    setHasText(text.trim().length > 0);
  };

  const handleNavClick = (item: string) => {
    if (item === "how-it-works") {
      const el = document.getElementById("how-it-works-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (item === "sources") {
      const el = document.getElementById("supported-platforms-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (item === "editorial") {
      setIsEditorialOpen(true);
    }
  };

  return (
    <div
      data-pencil-name="Home — Paste Link"
      className="relative flex min-h-[100svh] w-full flex-col overflow-x-hidden lg:h-[100svh] lg:max-h-[100svh] lg:overflow-hidden bg-[#F1EBE9] [--crowd-scale:0.7] xl:[--crowd-scale:0.8] min-[1400px]:[--crowd-scale:1]"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col pointer-events-none">
        <div className="pointer-events-auto">
          <Navbar
            onNavClick={handleNavClick}
            onLogin={() => setIsLoginOpen(true)}
            onOpenHistory={() => setIsHistoryOpen(true)}
          />
        </div>

        <div
          data-pencil-name="Hero"
          className="box-border flex w-full flex-col items-start gap-4 sm:gap-6 px-6 pt-1 sm:px-10 lg:gap-4 lg:px-20 lg:pt-2 pointer-events-none"
        >
          <div className="pointer-events-auto">
            <HeroHeadline />
          </div>

          <div
            data-pencil-name="Link Form"
            className="box-border flex w-full max-w-[760px] flex-col items-start gap-2.5 sm:gap-3 xl:gap-[14px] pointer-events-auto"
          >
            <LinkInputCard onCheck={onCheck} isLoading={isLoading} onTypingChange={handleTypingChange} />
            <div id="supported-platforms-section" className="w-full">
              <SupportedPlatforms />
            </div>
          </div>
        </div>

        {/* На десктопе прижимает шаги к низу экрана */}
        <div data-pencil-name="Spacer" className="hidden min-h-3 flex-1 lg:block pointer-events-none" />

        <div
          id="how-it-works-section"
          className="box-border w-full px-6 pb-6 pt-8 sm:px-10 lg:px-20 lg:pb-[30px] lg:pt-0 pointer-events-none"
        >
          <div className="pointer-events-auto w-fit">
            <HowItWorks />
          </div>
        </div>
      </div>

      <EmojiCrowd isTyping={isTyping} hasText={hasText} />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Editorial Info Modal */}
      {isEditorialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#4A3333]/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsEditorialOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-[#E2D7D4] bg-[#FBF8F7] p-6 sm:p-8 text-[#4A3333] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#EADFDc] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE4FD] text-[#6E1EF0]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black">Для редакций</h3>
                  <p className="text-xs font-semibold text-[#A27C7A]">Интеграция factholic в медиа</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorialOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[#F1EBE9] text-[#4A3333] hover:bg-[#E3D9D6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm font-semibold leading-relaxed text-[#4A3333]">
              <p>
                factholic предоставляет редакциям и фактчекерам инструменты автоматической проверки
                заявлений, поиск первоисточников в реальном времени и построение деревьев цитирования.
              </p>
              <div className="rounded-2xl bg-[#F1EBE9] p-4 text-xs font-bold text-[#A27C7A] flex flex-col gap-1.5">
                <span className="text-[#4A3333] font-black text-sm">Возможности API:</span>
                <span>• Автоматическая верификация входящих новостных лент</span>
                <span>• Поиск исходных цитат и контекста спикера</span>
                <span>• Детекция искажений при перепечатке (provenance graph)</span>
              </div>
              <p className="text-xs text-[#A27C7A] mt-1">
                Для подключения редакции напишите нам на <b className="text-[#4A3333]">press@factholic.ai</b>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#4A3333]/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsLoginOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-[28px] border border-[#E2D7D4] bg-[#FBF8F7] p-6 text-center text-[#4A3333] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F7FA] text-[#0AA6C2]">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-black">Личный кабинет</h3>
            <p className="mt-2 text-xs font-semibold text-[#A27C7A]">
              Все ваши проверки сохраняются автоматически в истории браузера. Авторизация через email и Telegram станет доступна в ближайшем обновлении!
            </p>
            <button
              type="button"
              onClick={() => setIsLoginOpen(false)}
              className="mt-5 w-full cursor-pointer rounded-full bg-[#4A3333] py-2.5 text-xs font-black text-white hover:bg-[#362424] transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
