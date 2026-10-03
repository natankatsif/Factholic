import React, { useState } from "react";
import { Link2, ArrowRight } from "lucide-react";

export const DEMO_URL = "https://www.youtube.com/watch?v=MOCK123";

interface HomeHeroProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
}

export function HomeHero({ onCheck, isLoading }: HomeHeroProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputValue.trim() || DEMO_URL;
    const isUrl =
      val.startsWith("http://") || val.startsWith("https://") || val === DEMO_URL;
    onCheck(val, isUrl);
  };

  const handleUseDemo = (demoType: "video" | "text") => {
    if (demoType === "video") {
      setInputValue(DEMO_URL);
      onCheck(DEMO_URL, true);
    } else {
      const demoText =
        "В Кишинёве обсуждают главные городские события. Вчера сгорел торговый центр, 200 пострадавших на месте происшествия. Спасатели продолжают ликвидацию последствий. В научной рубрике эксперты напомнили, что вода кипит при ста градусах везде, хоть на море, хоть в горах. В экономической сводке сообщается, что инфляция в стране упала до четырёх процентов к началу осени. Также отметим городскую инфраструктуру: новый мост в столице открыли точно в срок в августе.";
      setInputValue(demoText);
      onCheck(demoText, false);
    }
  };

  return (
    <div className="w-full flex justify-center items-center py-4 sm:py-8">
      {/* 1440x1024 exact frame container */}
      <div className="w-[1440px] max-w-full min-h-[960px] lg:h-[1024px] flex flex-col justify-between bg-[#F1EBE9] overflow-hidden relative shadow-sm">
        {/* Top Bar (p-[36px_80px]) */}
        <div className="w-full shrink-0 flex flex-row justify-between items-center px-8 sm:px-16 lg:px-20 pt-9 pb-4 z-10">
          <div className="text-[34px] leading-normal text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap cursor-pointer">
            factholic
          </div>

          <div className="flex flex-row items-center gap-10">
            <button
              type="button"
              className="text-[17px] leading-normal text-[#A27C7A] hover:text-[#4A3333] font-bold whitespace-nowrap hidden sm:block transition-colors cursor-pointer"
            >
              Как это работает
            </button>
            <button
              type="button"
              className="text-[17px] leading-normal text-[#A27C7A] hover:text-[#4A3333] font-bold whitespace-nowrap hidden md:block transition-colors cursor-pointer"
            >
              Источники
            </button>
            <button
              type="button"
              className="text-[17px] leading-normal text-[#A27C7A] hover:text-[#4A3333] font-bold whitespace-nowrap hidden lg:block transition-colors cursor-pointer"
            >
              Для редакций
            </button>
            <button
              type="button"
              className="px-6 py-3 outline-2 outline-[#4A3333] -outline-offset-1 rounded-full text-[17px] leading-normal text-[#4A3333] hover:bg-[#4A3333] hover:text-white font-bold transition-all whitespace-nowrap cursor-pointer"
            >
              Войти
            </button>
          </div>
        </div>

        {/* Hero Section (p-[40px_80px_0px_80px]) */}
        <div className="w-full shrink-0 flex flex-col gap-10 px-8 sm:px-16 lg:px-20 pt-4 z-10">
          {/* Headline Row */}
          <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-6">
            <div className="flex flex-col gap-5">
              <h1 className="text-7xl sm:text-8xl lg:text-[128px] leading-[118px] text-[#4A3333] font-black tracking-[-4px] whitespace-normal sm:whitespace-nowrap">
                Проверь
                <br />
                любое видео
              </h1>
              <p className="text-2xl sm:text-[30px] leading-normal text-[#A27C7A] font-extrabold whitespace-normal sm:whitespace-nowrap">
                Вставь ссылку — откроем плеер и разберём каждое утверждение
              </p>
            </div>

            {/* Stat (Right) */}
            <div className="flex flex-col items-start lg:items-end pt-4 shrink-0">
              <div className="text-[22px] leading-normal text-[#4A3333] font-extrabold whitespace-nowrap">
                Сегодня проверено
              </div>
              <div className="text-[60px] leading-none text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap my-1">
                9 412
              </div>
              <div className="text-[22px] leading-normal text-[#A27C7A] font-extrabold whitespace-nowrap">
                видео
              </div>
            </div>
          </div>

          {/* Link Form */}
          <div className="w-fit flex flex-col gap-[18px] items-start">
            <form
              onSubmit={handleSubmit}
              className="w-full sm:w-[760px] h-[80px] shrink-0 shadow-[0px_10px_30px_#4A333314] flex flex-row gap-3.5 p-2 pl-7 items-center bg-[#FBF8F7] outline-2 outline-[#E3D9D6] -outline-offset-1 rounded-full transition-all focus-within:outline-[#4A3333]"
            >
              <Link2 className="w-6 h-6 text-[#A27C7A] shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Вставь ссылку на видео…"
                className="text-[20px] flex-1 text-[#4A3333] placeholder-[#A27C7A] font-semibold bg-transparent border-none outline-none leading-normal min-w-0"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="h-full px-8 bg-[#4A3333] hover:bg-[#392626] disabled:opacity-50 text-white rounded-full flex items-center gap-2.5 transition-all cursor-pointer shrink-0"
              >
                <span className="text-[19px] font-extrabold whitespace-nowrap leading-normal">
                  {isLoading ? "Проверяем..." : "Проверить"}
                </span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </form>

            {/* Platforms */}
            <div className="flex flex-wrap items-center gap-2.5 pl-3">
              <span className="text-[15px] leading-normal text-[#A27C7A] font-bold whitespace-nowrap mr-1">
                Работает с
              </span>

              {/* YouTube */}
              <div className="flex items-center gap-1.5 p-[7px_14px_7px_10px] bg-[#FBF8F7] rounded-full">
                <svg className="w-[18px] h-[18px]" viewBox="0 0 14 14" fill="#E2353F">
                  <path d="M8.96875 6.61719l-2.625-1.75q-0.21875-0.10938-0.4375 0-0.21875 0.10938-0.21875 0.38281l0 3.5q0 0.27344 0.21875 0.38281 0.10938 0.05469 0.21875 0.05469 0.10938 0 0.21875-0.05469l2.625-1.75q0.21875-0.16406 0.21875-0.38281 0-0.21875-0.21875-0.38281z" />
                  <path d="M13.4 3.7q-.3-1.2-1.5-1.5C10.7 2 7 2 7 2s-3.7 0-4.9.2C.9 2.5.6 3.7.3 4.9 0 6.1 0 7 0 7s0 .9.3 2.1c.3 1.2.6 2.4 1.8 2.7 1.2.2 4.9.2 4.9.2s3.7 0 4.9-.2c1.2-.3 1.5-1.5 1.8-2.7.3-1.2.3-2.1.3-2.1s0-.9-.3-2.3zM6.5 8.8V5.2l3.2 1.8-3.2 1.8z" />
                </svg>
                <span className="text-[15px] leading-normal text-[#4A3333] font-bold">
                  YouTube
                </span>
              </div>

              {/* Shorts */}
              <div className="flex items-center gap-1.5 p-[7px_14px_7px_10px] bg-[#FBF8F7] rounded-full">
                <div className="w-3.5 h-3.5 rounded-full bg-[#E0368A] flex items-center justify-center">
                  <div className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white ml-0.5" />
                </div>
                <span className="text-[15px] leading-normal text-[#4A3333] font-bold">
                  Shorts
                </span>
              </div>

              {/* TikTok */}
              <div className="flex items-center gap-1.5 p-[7px_14px_7px_10px] bg-[#FBF8F7] rounded-full">
                <span className="text-xs font-black text-[#4A3333]">d</span>
                <span className="text-[15px] leading-normal text-[#4A3333] font-bold">
                  TikTok
                </span>
              </div>

              {/* Facebook */}
              <div className="flex items-center gap-1.5 p-[7px_14px_7px_10px] bg-[#FBF8F7] rounded-full">
                <span className="text-xs font-black text-[#1660D6]">f</span>
                <span className="text-[15px] leading-normal text-[#4A3333] font-bold">
                  Facebook
                </span>
              </div>

              {/* X */}
              <div className="flex items-center gap-1.5 p-[7px_14px_7px_10px] bg-[#FBF8F7] rounded-full">
                <span className="text-xs font-black text-[#4A3333]">𝕏</span>
                <span className="text-[15px] leading-normal text-[#4A3333] font-bold">
                  X
                </span>
              </div>

              {/* Demo button */}
              <button
                type="button"
                onClick={() => handleUseDemo("video")}
                className="text-xs font-extrabold text-[#4A3333] bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer ml-1"
              >
                ★ Запустить демо
              </button>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 w-full" />

        {/* Floating Pills (Pencil layout coordinates) */}
        <div className="hidden lg:block pointer-events-none">
          {/* Pill Disputed (left-[1250px] top-[600px] -rotate-4deg) */}
          <div className="absolute left-[1250px] top-[600px] -rotate-4 shadow-[0px_8px_24px_#4A33331F] flex flex-row gap-2.5 p-[10px_18px_10px_12px] items-center bg-[#FBF8F7] rounded-[100px] z-20">
            <div className="w-3 h-3 bg-[#FFC20E] rounded-full" />
            <span className="text-[17px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Спорно
            </span>
            <span className="text-[17px] text-[#A27C7A] font-extrabold whitespace-nowrap">
              32%
            </span>
          </div>

          {/* Pill Lie (left-[780px] top-[752px] rotate-6deg) */}
          <div className="absolute left-[780px] top-[752px] rotate-6 shadow-[0px_8px_24px_#4A33331F] flex flex-row gap-2.5 p-[10px_18px_10px_12px] items-center bg-[#FBF8F7] rounded-[100px] z-20">
            <div className="w-3 h-3 bg-[#E2353F] rounded-full" />
            <span className="text-[17px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Ложь
            </span>
            <span className="text-[17px] text-[#A27C7A] font-extrabold whitespace-nowrap">
              12%
            </span>
          </div>

          {/* Pill True (left-[1180px] top-[775px] -rotate-5deg) */}
          <div className="absolute left-[1180px] top-[775px] -rotate-5 shadow-[0px_8px_24px_#4A33331F] flex flex-row gap-2.5 p-[10px_18px_10px_12px] items-center bg-[#FBF8F7] rounded-[100px] z-20">
            <div className="w-3 h-3 bg-[#1DA57A] rounded-full" />
            <span className="text-[17px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Правда
            </span>
            <span className="text-[17px] text-[#A27C7A] font-extrabold whitespace-nowrap">
              95%
            </span>
          </div>
        </div>

        {/* Emoji Crowd (w-[740px] h-[524px] absolute left-[800px] top-[560px]) */}
        <div className="hidden lg:block w-[740px] h-[524px] absolute left-[800px] top-[560px] pointer-events-none z-0">
          {/* Blue Blob */}
          <div className="w-[240px] h-[240px] absolute left-[130px] top-[70px] bg-[#1660D6] rounded-[120px] shadow-sm">
            <div className="w-[52.8px] h-[38.4px] absolute left-[52.8px] top-[76.8px] bg-[#00000059] rounded-b-full" />
            <div className="w-[52.8px] h-[38.4px] absolute left-[134.4px] top-[76.8px] bg-[#00000059] rounded-b-full" />
            <div className="w-[38.4px] h-[9.6px] -rotate-[15deg] absolute left-[57.6px] top-[62.4px] bg-[#00000059] rounded-[4.8px]" />
            <div className="w-[38.4px] h-[9.6px] rotate-[15deg] absolute left-[144px] top-[69.6px] bg-[#00000059] rounded-[4.8px]" />
            <div className="w-[48px] h-[28.8px] absolute left-[96px] top-[139.2px] bg-[#00000059] rounded-t-full" />
          </div>

          {/* Teal Blob */}
          <div className="w-[220px] h-[220px] absolute left-[320px] top-[20px] bg-[#0AA6C2] rounded-[110px] shadow-sm">
            <div className="w-[26.4px] h-[26.4px] absolute left-[61.6px] top-[66px] bg-[#00000059] rounded-full" />
            <div className="w-[26.4px] h-[26.4px] absolute left-[127.6px] top-[66px] bg-[#00000059] rounded-full" />
            <div className="w-[26.4px] h-[22px] absolute left-[83.6px] top-[96.8px] bg-[#00000059] rounded-b-full" />
            <div className="w-[26.4px] h-[22px] absolute left-[107.8px] top-[96.8px] bg-[#00000059] rounded-b-full" />
          </div>

          {/* Green Blob */}
          <div className="w-[190px] h-[190px] absolute left-[500px] top-[110px] bg-[#1DA57A] rounded-[95px] shadow-sm">
            <div className="w-[30.4px] h-[8.55px] rotate-[25deg] absolute left-[38px] top-[68.4px] bg-[#00000059] rounded-[4.275px]" />
            <div className="w-[34.2px] h-[8.55px] -rotate-[25deg] absolute left-[106.4px] top-[53.2px] bg-[#00000059] rounded-[4.275px]" />
            <div className="w-[34.2px] h-[8.55px] rotate-[15deg] absolute left-[106.4px] top-[64.6px] bg-[#00000059] rounded-[4.275px]" />
            <div className="w-[68.4px] h-[9.5px] -rotate-[15deg] absolute left-[60.8px] top-[114px] bg-[#00000059] rounded-[4.75px]" />
          </div>

          {/* Purple Blob */}
          <div className="w-[270px] h-[270px] absolute left-[590px] top-[170px] bg-[#6E1EF0] rounded-[135px] shadow-sm">
            <div className="w-[43.2px] h-[12.15px] -rotate-[25deg] absolute left-[75.6px] top-[54px] bg-[#00000059] rounded-[6px]" />
            <div className="w-[43.2px] h-[12.15px] rotate-[25deg] absolute left-[151.2px] top-[54px] bg-[#00000059] rounded-[6px]" />
            <div className="w-[27px] h-[40.5px] absolute left-[81px] top-[81px] bg-[#00000059] rounded-full" />
            <div className="w-[27px] h-[40.5px] absolute left-[156.6px] top-[81px] bg-[#00000059] rounded-full" />
            <div className="w-[64.8px] h-[43.2px] absolute left-[102.6px] top-[140.4px] bg-[#00000059] rounded-t-full" />
          </div>

          {/* Red Blob */}
          <div className="w-[240px] h-[240px] absolute left-[20px] top-[240px] bg-[#E2353F] rounded-[120px] shadow-sm">
            <div className="w-[48px] h-[12px] rotate-[18deg] absolute left-[52.8px] top-[72px] bg-[#00000059] rounded-[6px]" />
            <div className="w-[48px] h-[12px] -rotate-[18deg] absolute left-[139.2px] top-[86.4px] bg-[#00000059] rounded-[6px]" />
            <div className="w-[21.6px] h-[21.6px] absolute left-[72px] top-[96px] bg-[#00000059] rounded-full" />
            <div className="w-[21.6px] h-[21.6px] absolute left-[144px] top-[96px] bg-[#00000059] rounded-full" />
            <div className="w-[67.2px] h-[12px] absolute left-[86.4px] top-[144px] bg-[#00000059] rounded-[6px]" />
          </div>

          {/* Pink Blob */}
          <div className="w-[250px] h-[250px] absolute left-[200px] top-[300px] bg-[#E0368A] rounded-[125px] shadow-sm">
            <div className="w-[25px] h-[42.5px] absolute left-[75px] top-[75px] bg-[#00000059] rounded-full" />
            <div className="w-[25px] h-[42.5px] absolute left-[150px] top-[75px] bg-[#00000059] rounded-full" />
            <div className="w-[85px] h-[12.5px] absolute left-[82.5px] top-[155px] bg-[#00000059] rounded-[6.25px]" />
          </div>

          {/* Yellow Blob */}
          <div className="w-[230px] h-[230px] absolute left-[370px] top-[250px] bg-[#FFC20E] rounded-[115px] shadow-sm">
            <div className="w-[23px] h-[36.8px] absolute left-[69px] top-[69px] bg-[#00000059] rounded-full" />
            <div className="w-[23px] h-[36.8px] absolute left-[138px] top-[69px] bg-[#00000059] rounded-full" />
            <div className="w-[101.2px] h-[69px] absolute left-[64.4px] top-[101.2px] bg-[#00000059] rounded-b-full" />
          </div>

          {/* Orange Blob */}
          <div className="w-[220px] h-[220px] absolute left-[540px] top-[320px] bg-[#FF7A12] rounded-[110px] shadow-sm">
            <div className="w-[35.2px] h-[22px] absolute left-[57.2px] top-[39.6px] bg-[#00000059] rounded-t-full" />
            <div className="w-[35.2px] h-[22px] absolute left-[127.6px] top-[39.6px] bg-[#00000059] rounded-t-full" />
            <div className="w-[17.6px] h-[26.4px] absolute left-[66px] top-[70.4px] bg-[#00000059] rounded-full" />
            <div className="w-[17.6px] h-[26.4px] absolute left-[136.4px] top-[70.4px] bg-[#00000059] rounded-full" />
            <div className="w-[26.4px] h-[30.8px] absolute left-[96.8px] top-[114.4px] bg-[#00000059] rounded-full" />
          </div>
        </div>

        {/* How It Works (p-[0px_80px_64px_80px]) */}
        <div className="w-fit flex flex-row gap-8 px-8 sm:px-16 lg:px-20 pb-16 pt-4 z-10">
          {/* Step 1 */}
          <div className="flex flex-row gap-3.5 items-center">
            <div className="w-[44px] h-[44px] flex justify-center items-center bg-[#FFC20E] rounded-[22px] shadow-xs">
              <span className="text-[20px] leading-normal text-white font-black whitespace-nowrap">
                1
              </span>
            </div>
            <div className="flex flex-col">
              <div className="text-[18px] leading-normal text-[#4A3333] font-extrabold whitespace-nowrap">
                Вставь ссылку
              </div>
              <div className="text-[15px] leading-normal text-[#A27C7A] font-semibold whitespace-nowrap">
                из любой соцсети
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-row gap-3.5 items-center">
            <div className="w-[44px] h-[44px] flex justify-center items-center bg-[#0AA6C2] rounded-[22px] shadow-xs">
              <span className="text-[20px] leading-normal text-white font-black whitespace-nowrap">
                2
              </span>
            </div>
            <div className="flex flex-col">
              <div className="text-[18px] leading-normal text-[#4A3333] font-extrabold whitespace-nowrap">
                Смотри в плеере
              </div>
              <div className="text-[15px] leading-normal text-[#A27C7A] font-semibold whitespace-nowrap">
                с метками на таймлайне
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-row gap-3.5 items-center">
            <div className="w-[44px] h-[44px] flex justify-center items-center bg-[#E0368A] rounded-[22px] shadow-xs">
              <span className="text-[20px] leading-normal text-white font-black whitespace-nowrap">
                3
              </span>
            </div>
            <div className="flex flex-col">
              <div className="text-[18px] leading-normal text-[#4A3333] font-extrabold whitespace-nowrap">
                Читай оценки
              </div>
              <div className="text-[15px] leading-normal text-[#A27C7A] font-semibold whitespace-nowrap">
                за, против и источники
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
