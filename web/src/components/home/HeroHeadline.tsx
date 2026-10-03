import React from "react";

export interface HeroHeadlineProps {
  /** TODO(frontend): брать из бэкенда, пока число из макета */
  todayVerifiedCount?: string;
  verifiedUnit?: string;
}

export function HeroHeadline({ todayVerifiedCount = "9 412", verifiedUnit = "тезисов" }: HeroHeadlineProps) {
  return (
    <div
      data-pencil-name="Headline Row"
      className="box-border flex w-full flex-col items-start justify-between gap-4 md:flex-row md:gap-8"
    >
      {/* min-w-0: блок заголовка сжимается и переносит подзаголовок, а не выталкивает счётчик за экран */}
      <div
        data-pencil-name="Title Block"
        className="box-border flex min-w-0 flex-col items-start gap-2.5 sm:gap-3.5 xl:gap-[16px]"
      >
        <h1
          data-pencil-name="Title"
          className="text-[42px]/[40px] sm:text-[60px]/[56px] md:text-[76px]/[72px] lg:text-[88px]/[84px] xl:text-[102px]/[96px] 2xl:text-[112px]/[104px] font-black tracking-[-2px] text-[#4A3333] xl:tracking-[-3px]"
        >
          Проверь
          <br />
          любой тезис
        </h1>

        <p
          data-pencil-name="Subtitle"
          className="text-sm font-extrabold leading-normal text-[#A27C7A] [text-wrap:balance] sm:text-base md:text-xl xl:text-[23px]"
        >
          Вставь тезис, новость или видео — разберём аргументы и найдём первоисточники
        </p>
      </div>

      <div
        data-pencil-name="Stat"
        className="box-border flex shrink-0 flex-col items-start pt-1 md:items-end md:pt-[6px]"
      >
        <div className="whitespace-nowrap text-xs font-extrabold leading-normal text-[#4A3333] sm:text-sm md:text-base xl:text-[18px]">
          Сегодня проверено
        </div>
        <div className="whitespace-nowrap text-2xl font-black leading-tight tracking-[-1px] text-[#4A3333] sm:text-3xl md:text-4xl xl:text-[50px]">
          {todayVerifiedCount}
        </div>
        <div className="whitespace-nowrap text-xs font-extrabold leading-normal text-[#A27C7A] sm:text-sm md:text-base xl:text-[18px]">
          {verifiedUnit}
        </div>
      </div>
    </div>
  );
}
