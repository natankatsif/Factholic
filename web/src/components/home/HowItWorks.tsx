import React from "react";

export function HowItWorks() {
  return (
    <div
      data-pencil-name="How It Works"
      className="box-border w-fit h-fit shrink-0 flex flex-col sm:flex-row gap-3 sm:gap-6 lg:gap-[32px] justify-start items-start relative z-10"
    >
      {/* Step 1 */}
      <div
        data-pencil-name="Step 1"
        className="box-border w-fit shrink-0 h-fit flex flex-row gap-3 sm:gap-[14px] justify-start items-center"
      >
        <div
          data-pencil-name="Num"
          className="box-border w-10 h-10 sm:w-[44px] sm:h-[44px] shrink-0 flex flex-row justify-center items-center bg-[#FFC20E] rounded-full"
        >
          <span
            data-pencil-name="N"
            className="text-lg sm:text-[20px] leading-normal box-border text-[#FFFFFF] font-black text-left whitespace-nowrap"
          >
            1
          </span>
        </div>
        <div
          data-pencil-name="Text"
          className="box-border w-fit shrink-0 h-fit flex flex-col justify-start items-start"
        >
          <span
            data-pencil-name="Title"
            className="text-base sm:text-[18px] leading-normal box-border text-[#4A3333] font-extrabold text-left whitespace-nowrap"
          >
            Вставь тезис
          </span>
          <span
            data-pencil-name="Sub"
            className="text-xs sm:text-[15px] leading-normal box-border text-[#A27C7A] font-semibold text-left whitespace-nowrap"
          >
            или ссылку на видео / новость
          </span>
        </div>
      </div>

      {/* Step 2 */}
      <div
        data-pencil-name="Step 2"
        className="box-border w-fit shrink-0 h-fit flex flex-row gap-3 sm:gap-[14px] justify-start items-center"
      >
        <div
          data-pencil-name="Num"
          className="box-border w-10 h-10 sm:w-[44px] sm:h-[44px] shrink-0 flex flex-row justify-center items-center bg-[#0AA6C2] rounded-full"
        >
          <span
            data-pencil-name="N"
            className="text-lg sm:text-[20px] leading-normal box-border text-[#FFFFFF] font-black text-left whitespace-nowrap"
          >
            2
          </span>
        </div>
        <div
          data-pencil-name="Text"
          className="box-border w-fit shrink-0 h-fit flex flex-col justify-start items-start"
        >
          <span
            data-pencil-name="Title"
            className="text-base sm:text-[18px] leading-normal box-border text-[#4A3333] font-extrabold text-left whitespace-nowrap"
          >
            Разбор аргументов
          </span>
          <span
            data-pencil-name="Sub"
            className="text-xs sm:text-[15px] leading-normal box-border text-[#A27C7A] font-semibold text-left whitespace-nowrap"
          >
            факты, таймлайн и контекст
          </span>
        </div>
      </div>

      {/* Step 3 */}
      <div
        data-pencil-name="Step 3"
        className="box-border w-fit shrink-0 h-fit flex flex-row gap-3 sm:gap-[14px] justify-start items-center"
      >
        <div
          data-pencil-name="Num"
          className="box-border w-10 h-10 sm:w-[44px] sm:h-[44px] shrink-0 flex flex-row justify-center items-center bg-[#E0368A] rounded-full"
        >
          <span
            data-pencil-name="N"
            className="text-lg sm:text-[20px] leading-normal box-border text-[#FFFFFF] font-black text-left whitespace-nowrap"
          >
            3
          </span>
        </div>
        <div
          data-pencil-name="Text"
          className="box-border w-fit shrink-0 h-fit flex flex-col justify-start items-start"
        >
          <span
            data-pencil-name="Title"
            className="text-base sm:text-[18px] leading-normal box-border text-[#4A3333] font-extrabold text-left whitespace-nowrap"
          >
            Читай вердикт
          </span>
          <span
            data-pencil-name="Sub"
            className="text-xs sm:text-[15px] leading-normal box-border text-[#A27C7A] font-semibold text-left whitespace-nowrap"
          >
            за, против и первоисточники
          </span>
        </div>
      </div>
    </div>
  );
}
