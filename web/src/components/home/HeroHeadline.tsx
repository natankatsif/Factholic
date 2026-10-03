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
      className="box-border w-full h-fit shrink-0 flex flex-col md:flex-row gap-6 md:gap-0 justify-between items-start"
    >
      {/* Title & Subtitle Block */}
      <div
        data-pencil-name="Title Block"
        className="box-border w-fit shrink-0 h-fit flex flex-col gap-3 sm:gap-4 xl:gap-[20px] justify-start items-start"
      >
        <h1
          data-pencil-name="Title"
          className="text-[48px]/[46px] sm:text-[72px]/[68px] md:text-[92px]/[88px] lg:text-[110px]/[104px] xl:text-[128px]/[118px] box-border text-[#4A3333] font-black tracking-[-2px] xl:tracking-[-4px] text-left"
        >
          Проверь
          <br />
          любое видео
        </h1>

        <p
          data-pencil-name="Subtitle"
          className="text-base sm:text-xl md:text-2xl xl:text-[30px] leading-normal box-border text-[#A27C7A] font-extrabold text-left whitespace-normal xl:whitespace-nowrap"
        >
          Вставь ссылку — откроем плеер и разберём каждое утверждение
        </p>
      </div>

      {/* Daily Verification Stat */}
      <div
        data-pencil-name="Stat"
        className="box-border w-fit shrink-0 h-fit flex flex-col gap-0 md:gap-[2px] pt-1 md:p-[16px_0px_0px_0px] justify-start items-start md:items-end self-start md:self-auto"
      >
        <div
          data-pencil-name="Stat Label"
          className="text-sm sm:text-base md:text-lg xl:text-[22px] leading-normal box-border text-[#4A3333] font-extrabold text-left md:text-right whitespace-nowrap"
        >
          Сегодня проверено
        </div>
        <div
          data-pencil-name="Stat Value"
          className="text-3xl sm:text-4xl md:text-5xl xl:text-[60px] leading-tight box-border text-[#4A3333] font-black tracking-[-1px] text-left md:text-right whitespace-nowrap"
        >
          {todayVerifiedCount}
        </div>
        <div
          data-pencil-name="Stat Unit"
          className="text-sm sm:text-base md:text-lg xl:text-[22px] leading-normal box-border text-[#A27C7A] font-extrabold text-left md:text-right whitespace-nowrap"
        >
          {verifiedUnit}
        </div>
      </div>
    </div>
  );
}
