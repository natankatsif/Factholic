import React from "react";

export interface HeroHeadlineProps {
  todayVerifiedCount?: string;
  verifiedUnit?: string;
}

export function HeroHeadline({
  todayVerifiedCount = "9 412",
  verifiedUnit = "видео",
}: HeroHeadlineProps) {
  return (
    <div
      data-pencil-name="Headline Row"
      className="box-border w-full h-fit shrink-0 flex flex-col md:flex-row gap-4 md:gap-0 justify-between items-start"
    >
      {/* Title & Subtitle Block */}
      <div
        data-pencil-name="Title Block"
        className="box-border w-fit shrink-0 h-fit flex flex-col gap-2.5 sm:gap-3.5 xl:gap-[16px] justify-start items-start"
      >
        <h1
          data-pencil-name="Title"
          className="text-[42px]/[40px] sm:text-[60px]/[56px] md:text-[76px]/[72px] lg:text-[88px]/[84px] xl:text-[102px]/[96px] 2xl:text-[112px]/[104px] box-border text-[#4A3333] font-black tracking-[-2px] xl:tracking-[-3px] text-left"
        >
          Проверь
          <br />
          любой тезис
        </h1>

        <p
          data-pencil-name="Subtitle"
          className="text-sm sm:text-base md:text-xl xl:text-[23px] 2xl:text-[26px] leading-normal box-border text-[#A27C7A] font-extrabold text-left whitespace-normal xl:whitespace-nowrap"
        >
          Вставь тезис, новость или видео — разберём аргументы и найдём первоисточники
        </p>
      </div>

      {/* Daily Verification Stat */}
      <div
        data-pencil-name="Stat"
        className="box-border w-fit shrink-0 h-fit flex flex-col gap-0 md:gap-[1px] pt-1 md:p-[6px_0px_0px_0px] justify-start items-start md:items-end self-start md:self-auto"
      >
        <div
          data-pencil-name="Stat Label"
          className="text-xs sm:text-sm md:text-base xl:text-[18px] leading-normal box-border text-[#4A3333] font-extrabold text-left md:text-right whitespace-nowrap"
        >
          Сегодня проверено
        </div>
        <div
          data-pencil-name="Stat Value"
          className="text-2xl sm:text-3xl md:text-4xl xl:text-[50px] leading-tight box-border text-[#4A3333] font-black tracking-[-1px] text-left md:text-right whitespace-nowrap"
        >
          {todayVerifiedCount}
        </div>
        <div
          data-pencil-name="Stat Unit"
          className="text-xs sm:text-sm md:text-base xl:text-[18px] leading-normal box-border text-[#A27C7A] font-extrabold text-left md:text-right whitespace-nowrap"
        >
          тезисов
        </div>
      </div>
    </div>
  );
}
