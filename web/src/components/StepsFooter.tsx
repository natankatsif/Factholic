import React from "react";

export function StepsFooter() {
  return (
    <div className="w-full flex flex-col sm:flex-row gap-5 sm:gap-9 px-6 sm:px-10 lg:px-16 pb-4 sm:pb-6 pt-2 z-10 shrink-0">
      {/* Step 1 */}
      <div className="flex flex-row gap-3 items-center">
        <div className="w-[36px] h-[36px] flex justify-center items-center bg-[#FFC20E] rounded-full shadow-xs shrink-0">
          <span className="text-[17px] leading-normal text-white font-black whitespace-nowrap">
            1
          </span>
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] sm:text-[16px] leading-tight text-[#4A3333] font-extrabold whitespace-nowrap">
            Вставь ссылку
          </div>
          <div className="text-[13px] leading-tight text-[#A27C7A] font-semibold whitespace-nowrap mt-0.5">
            из любой соцсети
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex flex-row gap-3 items-center">
        <div className="w-[36px] h-[36px] flex justify-center items-center bg-[#0AA6C2] rounded-full shadow-xs shrink-0">
          <span className="text-[17px] leading-normal text-white font-black whitespace-nowrap">
            2
          </span>
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] sm:text-[16px] leading-tight text-[#4A3333] font-extrabold whitespace-nowrap">
            Смотри в плеере
          </div>
          <div className="text-[13px] leading-tight text-[#A27C7A] font-semibold whitespace-nowrap mt-0.5">
            с метками на таймлайне
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex flex-row gap-3 items-center">
        <div className="w-[36px] h-[36px] flex justify-center items-center bg-[#E0368A] rounded-full shadow-xs shrink-0">
          <span className="text-[17px] leading-normal text-white font-black whitespace-nowrap">
            3
          </span>
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] sm:text-[16px] leading-tight text-[#4A3333] font-extrabold whitespace-nowrap">
            Читай оценки
          </div>
          <div className="text-[13px] leading-tight text-[#A27C7A] font-semibold whitespace-nowrap mt-0.5">
            за, против и источники
          </div>
        </div>
      </div>
    </div>
  );
}
