import React from "react";

interface HeroTitleProps {
  todayVerifiedCount?: string;
}

export function HeroTitle({ todayVerifiedCount = "9 412" }: HeroTitleProps) {
  return (
    <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-4 shrink-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl sm:text-5xl lg:text-[54px] xl:text-[62px] leading-[1.0] text-[#4A3333] font-black tracking-[-1.5px] sm:tracking-[-2px]">
          Проверь
          <br />
          любое видео
        </h1>
        <p className="text-base sm:text-lg lg:text-[19px] leading-snug text-[#A27C7A] font-extrabold max-w-[560px]">
          Вставь ссылку — откроем плеер и разберём каждое утверждение
        </p>
      </div>

      <div className="flex flex-col items-start lg:items-end pt-1 shrink-0">
        <div className="text-sm sm:text-[15px] leading-normal text-[#4A3333] font-extrabold whitespace-nowrap">
          Сегодня проверено
        </div>
        <div className="text-2xl sm:text-3xl lg:text-[38px] leading-tight text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap">
          {todayVerifiedCount}
        </div>
        <div className="text-xs sm:text-[14px] leading-normal text-[#A27C7A] font-extrabold whitespace-nowrap">
          видео
        </div>
      </div>
    </div>
  );
}
