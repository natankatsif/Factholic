"use client";

import React, { useState } from "react";
import { useCrowdSay, clearCrowdSay, markCrowdSay } from "../../lib/history-ui";
import { Navbar } from "./Navbar";
import { HeroHeadline } from "./HeroHeadline";
import { LinkInputCard } from "./LinkInputCard";
import { SupportedPlatforms, platformOfLink, type PlatformId } from "./SupportedPlatforms";
import { HowItWorks } from "./HowItWorks";
import { EmojiCrowd } from "./EmojiCrowd";
import { HistoryDrawer } from "../history/HistoryDrawer";
import { UserCheck } from "lucide-react";
import { AudienceModal, type Audience } from "./AudienceModal";

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
  // открытое окно «Для редакций» / «Для бизнеса»
  const [audience, setAudience] = useState<Audience | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  // выбранная плашка «Попробуй с»: поле ввода — ссылка с этой платформы; null — текст
  const [linkPlatform, setLinkPlatform] = useState<PlatformId | null>(null);
  // проверка вернулась без утверждений — бирюзовый говорит почему, поле снова с введённым
  const crowdSay = useCrowdSay();

  const handleTypingChange = (typing: boolean, text: string) => {
    setIsTyping(typing);
    setHasText(text.trim().length > 0);
    // начали править введённое — реплика про прошлую попытку больше не к месту
    if (crowdSay && text.trim() !== crowdSay.input.trim()) clearCrowdSay();
  };

  const handleCheck = (urlOrText: string, isUrl: boolean) => {
    // ссылка с платформы, которую бэкенд ещё не умеет, — не запускаем проверку, бирюзовый говорит, что скоро
    const platform = isUrl ? platformOfLink(urlOrText) : null;
    if (platform?.soon) {
      markCrowdSay({
        message: `${platform.name} пока в разработке 🛠 Скоро научусь и его — а пока вставь текст поста или ссылку на YouTube`,
        input: urlOrText,
        isUrl: true,
      });
      return;
    }
    clearCrowdSay();
    onCheck(urlOrText, isUrl);
  };

  const handleNavClick = (item: string) => {
    if (item === "editorial" || item === "business") setAudience(item);
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
            <LinkInputCard
              onCheck={handleCheck}
              prefill={crowdSay}
              isLoading={isLoading}
              onTypingChange={handleTypingChange}
              platform={linkPlatform}
              onPlatformChange={setLinkPlatform}
            />
            <div id="supported-platforms-section" className="w-full">
              <SupportedPlatforms active={linkPlatform} onSelect={setLinkPlatform} />
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

      <EmojiCrowd
        isTyping={isTyping}
        hasText={hasText}
        platform={linkPlatform}
        speech={crowdSay?.message ?? null}
        onSpeechEnd={clearCrowdSay}
      />

      {/* History Drawer */}
      <HistoryDrawer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {/* «Для редакций» / «Для бизнеса» */}
      {audience && <AudienceModal audience={audience} onClose={() => setAudience(null)} />}

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
              Все ваши проверки сохраняются автоматически в истории браузера. Авторизация через email и
              Telegram станет доступна в ближайшем обновлении!
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
