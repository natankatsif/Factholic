import React from "react";
import { Navbar } from "./Navbar";
import { HeroTitle } from "./HeroTitle";
import { LinkInputCard } from "./LinkInputCard";
import { FloatingPills } from "./FloatingPills";
import { EmojiBlobs } from "./EmojiBlobs";
import { StepsFooter } from "./StepsFooter";

interface HomeHeroProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
}

export function HomeHero({ onCheck, isLoading }: HomeHeroProps) {
  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden relative select-none">
      {/* 0. Background Cartoon Character Crowd */}
      <EmojiBlobs />

      {/* 1. Header / Navbar */}
      <Navbar onGoHome={() => {}} />

      {/* 2. Central Content Area */}
      <div className="w-full flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 z-10 gap-6 xl:gap-8 relative">
        {/* Title and stats */}
        <HeroTitle todayVerifiedCount="9 412" />

        {/* Input Card & Supported Platforms */}
        <LinkInputCard onCheck={onCheck} isLoading={isLoading} />
      </div>

      {/* 3. Floating Visual Pills */}
      <FloatingPills />

      {/* 4. Bottom Steps Guide */}
      <StepsFooter />
    </div>
  );
}
