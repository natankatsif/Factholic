import React from "react";

export function FloatingPills() {
  return (
    <div className="hidden lg:block pointer-events-none select-none z-10">
      {/* Pill Disputed (top right) */}
      <div className="absolute right-[80px] xl:right-[130px] top-[38%] -rotate-4 shadow-[0px_6px_20px_#4A333318] flex flex-row gap-2 px-3 py-1.5 items-center bg-[#FBF8F7] rounded-full">
        <div className="w-2.5 h-2.5 bg-[#FFC20E] rounded-full" />
        <span className="text-[14px] sm:text-[15px] text-[#4A3333] font-extrabold whitespace-nowrap">
          Спорно
        </span>
        <span className="text-[14px] sm:text-[15px] text-[#A27C7A] font-extrabold whitespace-nowrap">
          32%
        </span>
      </div>

      {/* Pill Lie (middle right) */}
      <div className="absolute right-[310px] xl:right-[370px] bottom-[140px] rotate-6 shadow-[0px_6px_20px_#4A333318] flex flex-row gap-2 px-3 py-1.5 items-center bg-[#FBF8F7] rounded-full">
        <div className="w-2.5 h-2.5 bg-[#E2353F] rounded-full" />
        <span className="text-[14px] sm:text-[15px] text-[#4A3333] font-extrabold whitespace-nowrap">
          Ложь
        </span>
        <span className="text-[14px] sm:text-[15px] text-[#A27C7A] font-extrabold whitespace-nowrap">
          12%
        </span>
      </div>

      {/* Pill True (bottom right) */}
      <div className="absolute right-[50px] xl:right-[90px] bottom-[110px] -rotate-5 shadow-[0px_6px_20px_#4A333318] flex flex-row gap-2 px-3 py-1.5 items-center bg-[#FBF8F7] rounded-full">
        <div className="w-2.5 h-2.5 bg-[#1DA57A] rounded-full" />
        <span className="text-[14px] sm:text-[15px] text-[#4A3333] font-extrabold whitespace-nowrap">
          Правда
        </span>
        <span className="text-[14px] sm:text-[15px] text-[#A27C7A] font-extrabold whitespace-nowrap">
          95%
        </span>
      </div>
    </div>
  );
}
