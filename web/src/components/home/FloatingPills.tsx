import React from "react";

export function FloatingPills() {
  return (
    <>
      {/* Pill Lie (12%) */}
      <div
        data-pencil-name="Pill Lie"
        className="box-border w-fit h-fit [transform:rotate(6deg)] [transform-origin:top_left] [box-shadow:0px_8px_24px_#4A33331F] absolute left-[56%] xl:left-[770px] bottom-[170px] xl:bottom-[210px] flex flex-row gap-[10px] p-[8px_16px_8px_12px] xl:p-[10px_18px_10px_12px] justify-start items-center bg-[#FBF8F7] rounded-[100px] z-[5] select-none pointer-events-none hover:scale-105 transition-transform"
      >
        <div
          data-pencil-name="Dot"
          className="box-border w-[12px] shrink-0 h-[12px] bg-[#E2353F] rounded-full"
        />
        <div
          data-pencil-name="Label"
          className="text-sm xl:text-[17px] leading-normal box-border text-[#4A3333] font-extrabold text-left whitespace-nowrap"
        >
          Ложь
        </div>
        <div
          data-pencil-name="Value"
          className="text-sm xl:text-[17px] leading-normal box-border text-[#A27C7A] font-extrabold text-left whitespace-nowrap"
        >
          12%
        </div>
      </div>

      {/* Pill True (95%) */}
      <div
        data-pencil-name="Pill True"
        className="box-border w-fit h-fit [transform:rotate(-5deg)] [transform-origin:top_left] [box-shadow:0px_8px_24px_#4A33331F] absolute right-[50px] xl:left-[1160px] bottom-[145px] xl:bottom-[180px] flex flex-row gap-[10px] p-[8px_16px_8px_12px] xl:p-[10px_18px_10px_12px] justify-start items-center bg-[#FBF8F7] rounded-[100px] z-[6] select-none pointer-events-none hover:scale-105 transition-transform"
      >
        <div
          data-pencil-name="Dot"
          className="box-border w-[12px] shrink-0 h-[12px] bg-[#1DA57A] rounded-full"
        />
        <div
          data-pencil-name="Label"
          className="text-sm xl:text-[17px] leading-normal box-border text-[#4A3333] font-extrabold text-left whitespace-nowrap"
        >
          Правда
        </div>
        <div
          data-pencil-name="Value"
          className="text-sm xl:text-[17px] leading-normal box-border text-[#A27C7A] font-extrabold text-left whitespace-nowrap"
        >
          95%
        </div>
      </div>

      {/* Pill Disputed (32%) */}
      <div
        data-pencil-name="Pill Disputed"
        className="box-border w-fit h-fit [transform:rotate(-4deg)] [transform-origin:top_left] [box-shadow:0px_8px_24px_#4A33331F] absolute right-[30px] xl:left-[1220px] bottom-[310px] xl:bottom-[355px] flex flex-row gap-[10px] p-[8px_16px_8px_12px] xl:p-[10px_18px_10px_12px] justify-start items-center bg-[#FBF8F7] rounded-[100px] z-[7] select-none pointer-events-none hover:scale-105 transition-transform"
      >
        <div
          data-pencil-name="Dot"
          className="box-border w-[12px] shrink-0 h-[12px] bg-[#FFC20E] rounded-full"
        />
        <div
          data-pencil-name="Label"
          className="text-sm xl:text-[17px] leading-normal box-border text-[#4A3333] font-extrabold text-left whitespace-nowrap"
        >
          Спорно
        </div>
        <div
          data-pencil-name="Value"
          className="text-sm xl:text-[17px] leading-normal box-border text-[#A27C7A] font-extrabold text-left whitespace-nowrap"
        >
          32%
        </div>
      </div>
    </>
  );
}
