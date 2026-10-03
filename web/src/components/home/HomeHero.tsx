import React, { useState } from "react";
import { Navbar } from "./Navbar";
import { HeroHeadline } from "./HeroHeadline";
import { LinkInputCard } from "./LinkInputCard";
import { SupportedPlatforms } from "./SupportedPlatforms";
import { HowItWorks } from "./HowItWorks";
import { EmojiCrowd } from "./EmojiCrowd";
import { FloatingPills } from "./FloatingPills";

export interface HomeHeroProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
  onLogin?: () => void;
}

const PLATFORM_DEMO_URLS: Record<string, string> = {
  youtube: "https://www.youtube.com/watch?v=kP_q4b54e7U",
  shorts: "https://www.youtube.com/shorts/7A6Q9u_x2mK",
  tiktok: "https://www.tiktok.com/@factcheck/video/739182390123",
  facebook: "https://www.facebook.com/watch/?v=98127391238",
  x: "https://x.com/news/status/178923489123490",
};

export function HomeHero({ onCheck, isLoading, onLogin }: HomeHeroProps) {
  const [selectedUrl, setSelectedUrl] = useState<string>("");

  const handleSelectPlatform = (platform: string) => {
    const demo = PLATFORM_DEMO_URLS[platform];
    if (demo) {
      setSelectedUrl(demo);
    }
  };

  return (
    <div
      data-pencil-name="Home — Paste Link"
      className="box-border w-full max-w-[1440px] h-screen max-h-screen flex flex-col justify-between items-start bg-[#F1EBE9] overflow-hidden relative mx-auto select-none"
    >
      {/* 1. Top Bar / Navbar */}
      <Navbar onLogin={onLogin} onGoHome={() => setSelectedUrl("")} />

      {/* 2. Hero Section: Headline + Link Form */}
      <div
        data-pencil-name="Hero"
        className="box-border w-full h-fit shrink-0 flex flex-col gap-4 sm:gap-6 xl:gap-[24px] px-6 sm:px-10 lg:px-20 pt-1 lg:pt-[10px] justify-start items-start relative z-10"
      >
        {/* Headline Row: Title Block + Daily Verified Stat */}
        <HeroHeadline todayVerifiedCount="9 412" verifiedUnit="видео" />

        {/* Link Form: Link Input Pill + Platform Badges */}
        <div
          data-pencil-name="Link Form"
          className="box-border w-full max-w-[760px] h-fit shrink-0 flex flex-col gap-2.5 sm:gap-3 xl:gap-[14px] justify-start items-start"
        >
          <LinkInputCard
            key={selectedUrl}
            defaultValue={selectedUrl}
            onCheck={onCheck}
            isLoading={isLoading}
          />

          <SupportedPlatforms onSelectPlatform={handleSelectPlatform} />
        </div>
      </div>

      {/* 3. Flexible Spacer */}
      <div
        data-pencil-name="Spacer"
        className="box-border w-full flex-1 min-h-[16px] flex flex-row justify-start items-start relative z-0"
      />

      {/* 4. Background Illustration: Emoji Cartoon Crowd (positioned at bottom-right) */}
      <div className="hidden lg:block pointer-events-none">
        <EmojiCrowd />
      </div>

      {/* 5. Floating Verdict Pills (Lie 12%, Disputed 32%, True 95%) */}
      <div className="hidden lg:block pointer-events-none">
        <FloatingPills />
      </div>

      {/* 6. Bottom Guide: How It Works Steps 1, 2, 3 */}
      <div className="box-border w-full h-fit shrink-0 px-6 sm:px-10 lg:px-20 pb-5 sm:pb-6 lg:pb-[36px] relative z-10">
        <HowItWorks />
      </div>
    </div>
  );
}
