import React from "react";

export function FloatingPills() {
  return (
    <div className="hidden lg:block pointer-events-none select-none">
      {/* Pill Disputed (top right) */}
      <div className="absolute right-[40px] xl:right-[110px] top-[48%] -rotate-4 shadow-[0px_8px_24px_#4A33331F] flex flex-row gap-2.5 p-[10px_18px_10px_12px] items-center bg-[#FBF8F7] rounded-full z-20">
        <div className="w-3 h-3 bg-[#FFC20E] rounded-full" />
        <span className="text-[17px] text-[#4A3333] font-extrabold whitespace-nowrap">
          Спорно
        </span>
        <span className="text-[17px] text-[#A27C7A] font-extrabold whitespace-nowrap">
          32%
        </span>
      </div>

      {/* Pill Lie (bottom left of blobs) */}
      <div className="absolute right-[380px] xl:right-[480px] bottom-[140px] rotate-6 shadow-[0px_8px_24px_#4A33331F] flex flex-row gap-2.5 p-[10px_18px_10px_12px] items-center bg-[#FBF8F7] rounded-full z-20">
        <div className="w-3 h-3 bg-[#E2353F] rounded-full" />
        <span className="text-[17px] text-[#4A3333] font-extrabold whitespace-nowrap">
          Ложь
        </span>
        <span className="text-[17px] text-[#A27C7A] font-extrabold whitespace-nowrap">
          12%
        </span>
      </div>

      {/* Pill True (bottom right) */}
      <div className="absolute right-[80px] xl:right-[150px] bottom-[110px] -rotate-5 shadow-[0px_8px_24px_#4A33331F] flex flex-row gap-2.5 p-[10px_18px_10px_12px] items-center bg-[#FBF8F7] rounded-full z-20">
        <div className="w-3 h-3 bg-[#1DA57A] rounded-full" />
        <span className="text-[17px] text-[#4A3333] font-extrabold whitespace-nowrap">
          Правда
        </span>
        <span className="text-[17px] text-[#A27C7A] font-extrabold whitespace-nowrap">
          95%
        </span>
      </div>
    </div>
  );
}
