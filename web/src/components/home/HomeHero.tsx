import React from "react";
import { Navbar } from "./Navbar";
import { HeroHeadline } from "./HeroHeadline";
import { LinkInputCard } from "./LinkInputCard";
import { SupportedPlatforms } from "./SupportedPlatforms";
import { HowItWorks } from "./HowItWorks";
import { EmojiCrowd } from "./EmojiCrowd";

export interface HomeHeroProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
}

/**
 * Главная по макету «Home — Paste Link» (1440×1024).
 *
 * Мобильные/планшет: всё в одну колонку, смайлики — блоком внизу.
 * Десктоп (lg+): смайлики прижаты к правому нижнему углу экрана и масштабируются через --crowd-scale,
 * шаги «как это работает» — внизу слева и не заходят на смайлики (ширина ограничена в HowItWorks).
 */
export function HomeHero({ onCheck, isLoading }: HomeHeroProps) {
  const [isTyping, setIsTyping] = React.useState(false);
  const [hasText, setHasText] = React.useState(false);

  const handleTypingChange = (typing: boolean, text: string) => {
    setIsTyping(typing);
    setHasText(text.trim().length > 0);
  };

  return (
    <div
      data-pencil-name="Home — Paste Link"
      className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#F1EBE9] [--crowd-scale:0.7] xl:[--crowd-scale:0.8] min-[1400px]:[--crowd-scale:1]"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <Navbar />

        <div
          data-pencil-name="Hero"
          className="box-border flex w-full flex-col items-start gap-5 px-6 pt-1 sm:gap-6 sm:px-10 lg:px-20 lg:pt-[10px]"
        >
          <HeroHeadline />

          <div
            data-pencil-name="Link Form"
            className="box-border flex w-full max-w-[760px] flex-col items-start gap-3 xl:gap-[14px]"
          >
            <LinkInputCard
              onCheck={onCheck}
              isLoading={isLoading}
              onTypingChange={handleTypingChange}
            />
            <SupportedPlatforms />
          </div>
        </div>

        {/* На десктопе прижимает шаги к низу экрана */}
        <div data-pencil-name="Spacer" className="hidden min-h-6 flex-1 lg:block" />

        <div className="box-border w-full px-6 pb-6 pt-8 sm:px-10 lg:px-20 lg:pb-[36px] lg:pt-0">
          <HowItWorks />
        </div>
      </div>

      <EmojiCrowd isTyping={isTyping} hasText={hasText} />
    </div>
  );
}
