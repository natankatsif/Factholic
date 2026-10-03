import React from "react";

interface HeroTitleProps {
  todayVerifiedCount?: string;
}

export function HeroTitle({ todayVerifiedCount = "9 412" }: HeroTitleProps) {
  return (
    <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-6 shrink-0">
      <div className="flex flex-col gap-3 sm:gap-4">
        <h1 className="text-6xl sm:text-7xl lg:text-[110px] xl:text-[124px] leading-[0.93] text-[#4A3333] font-black tracking-[-3px] sm:tracking-[-4px]">
          Проверь
          <br />
          любое видео
        </h1>
        <p className="text-xl sm:text-2xl lg:text-[28px] leading-normal text-[#A27C7A] font-extrabold max-w-[850px]">
          Вставь ссылку — откроем плеер и разберём каждое утверждение
        </p>
      </div>

      <div className="flex flex-col items-start lg:items-end pt-2 sm:pt-4 shrink-0">
        <div className="text-lg sm:text-[22px] leading-normal text-[#4A3333] font-extrabold whitespace-nowrap">
          Сегодня проверено
        </div>
        <div className="text-4xl sm:text-5xl lg:text-[56px] leading-none text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap my-1">
          {todayVerifiedCount}
        </div>
        <div className="text-lg sm:text-[22px] leading-normal text-[#A27C7A] font-extrabold whitespace-nowrap">
          видео
        </div>
      </div>
    </div>
  );
}
