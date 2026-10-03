import React from "react";

export function EmojiBlobs() {
  return (
    <div className="hidden lg:block w-[580px] h-[360px] xl:w-[680px] xl:h-[420px] absolute right-4 xl:right-12 bottom-6 pointer-events-none select-none z-0 opacity-95">
      {/* Blue Blob */}
      <div className="w-[190px] h-[190px] absolute left-[100px] top-[40px] bg-[#1660D6] rounded-full shadow-sm">
        <div className="w-[42px] h-[30px] absolute left-[42px] top-[60px] bg-black/35 rounded-b-full" />
        <div className="w-[42px] h-[30px] absolute left-[108px] top-[60px] bg-black/35 rounded-b-full" />
        <div className="w-[30px] h-[7px] -rotate-[15deg] absolute left-[46px] top-[48px] bg-black/35 rounded-full" />
        <div className="w-[30px] h-[7px] rotate-[15deg] absolute left-[114px] top-[54px] bg-black/35 rounded-full" />
        <div className="w-[38px] h-[22px] absolute left-[76px] top-[110px] bg-black/35 rounded-t-full" />
      </div>

      {/* Teal Blob */}
      <div className="w-[170px] h-[170px] absolute left-[250px] top-[0px] bg-[#0AA6C2] rounded-full shadow-sm">
        <div className="w-[20px] h-[20px] absolute left-[48px] top-[52px] bg-black/35 rounded-full" />
        <div className="w-[20px] h-[20px] absolute left-[102px] top-[52px] bg-black/35 rounded-full" />
        <div className="w-[20px] h-[18px] absolute left-[66px] top-[76px] bg-black/35 rounded-b-full" />
        <div className="w-[20px] h-[18px] absolute left-[86px] top-[76px] bg-black/35 rounded-b-full" />
      </div>

      {/* Green Blob */}
      <div className="w-[150px] h-[150px] absolute left-[390px] top-[70px] bg-[#1DA57A] rounded-full shadow-sm">
        <div className="w-[24px] h-[7px] rotate-[25deg] absolute left-[30px] top-[54px] bg-black/35 rounded-full" />
        <div className="w-[28px] h-[7px] -rotate-[25deg] absolute left-[84px] top-[42px] bg-black/35 rounded-full" />
        <div className="w-[28px] h-[7px] rotate-[15deg] absolute left-[84px] top-[50px] bg-black/35 rounded-full" />
        <div className="w-[54px] h-[8px] -rotate-[15deg] absolute left-[48px] top-[90px] bg-black/35 rounded-full" />
      </div>

      {/* Purple Blob */}
      <div className="w-[210px] h-[210px] absolute left-[440px] top-[120px] bg-[#6E1EF0] rounded-full shadow-sm">
        <div className="w-[34px] h-[9px] -rotate-[25deg] absolute left-[60px] top-[42px] bg-black/35 rounded-full" />
        <div className="w-[34px] h-[9px] rotate-[25deg] absolute left-[120px] top-[42px] bg-black/35 rounded-full" />
        <div className="w-[22px] h-[32px] absolute left-[64px] top-[64px] bg-black/35 rounded-full" />
        <div className="w-[22px] h-[32px] absolute left-[124px] top-[64px] bg-black/35 rounded-full" />
        <div className="w-[52px] h-[34px] absolute left-[82px] top-[110px] bg-black/35 rounded-t-full" />
      </div>

      {/* Red Blob */}
      <div className="w-[190px] h-[190px] absolute left-[10px] top-[170px] bg-[#E2353F] rounded-full shadow-sm">
        <div className="w-[38px] h-[10px] rotate-[18deg] absolute left-[42px] top-[56px] bg-black/35 rounded-full" />
        <div className="w-[38px] h-[10px] -rotate-[18deg] absolute left-[110px] top-[68px] bg-black/35 rounded-full" />
        <div className="w-[17px] h-[17px] absolute left-[56px] top-[76px] bg-black/35 rounded-full" />
        <div className="w-[17px] h-[17px] absolute left-[114px] top-[76px] bg-black/35 rounded-full" />
        <div className="w-[54px] h-[10px] absolute left-[68px] top-[114px] bg-black/35 rounded-full" />
      </div>

      {/* Pink Blob */}
      <div className="w-[200px] h-[200px] absolute left-[150px] top-[210px] bg-[#E0368A] rounded-full shadow-sm">
        <div className="w-[20px] h-[34px] absolute left-[60px] top-[60px] bg-black/35 rounded-full" />
        <div className="w-[20px] h-[34px] absolute left-[120px] top-[60px] bg-black/35 rounded-full" />
        <div className="w-[68px] h-[10px] absolute left-[66px] top-[124px] bg-black/35 rounded-full" />
      </div>

      {/* Yellow Blob */}
      <div className="w-[180px] h-[180px] absolute left-[290px] top-[180px] bg-[#FFC20E] rounded-full shadow-sm">
        <div className="w-[18px] h-[30px] absolute left-[54px] top-[54px] bg-black/35 rounded-full" />
        <div className="w-[18px] h-[30px] absolute left-[108px] top-[54px] bg-black/35 rounded-full" />
        <div className="w-[80px] h-[54px] absolute left-[50px] top-[80px] bg-black/35 rounded-b-full" />
      </div>

      {/* Orange Blob */}
      <div className="w-[170px] h-[170px] absolute left-[420px] top-[230px] bg-[#FF7A12] rounded-full shadow-sm">
        <div className="w-[28px] h-[18px] absolute left-[44px] top-[32px] bg-black/35 rounded-t-full" />
        <div className="w-[28px] h-[18px] absolute left-[100px] top-[32px] bg-black/35 rounded-t-full" />
        <div className="w-[14px] h-[20px] absolute left-[52px] top-[56px] bg-black/35 rounded-full" />
        <div className="w-[14px] h-[20px] absolute left-[108px] top-[56px] bg-black/35 rounded-full" />
        <div className="w-[20px] h-[24px] absolute left-[76px] top-[90px] bg-black/35 rounded-full" />
      </div>
    </div>
  );
}
