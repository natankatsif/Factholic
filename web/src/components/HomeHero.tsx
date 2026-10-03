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
    const isUrl = val.startsWith("http://") || val.startsWith("https://") || val === DEMO_URL;
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
    <div className="box-border w-full max-w-[1440px] mx-auto min-h-[920px] flex flex-col justify-between bg-[#F1EBE9] overflow-hidden relative select-none">
      {/* Top Bar */}
      <div className="w-full flex flex-row justify-between items-center px-6 sm:px-12 lg:px-20 py-8 z-10">
        <div className="text-[34px] text-[#4A3333] font-black tracking-[-1px] whitespace-nowrap cursor-pointer">
          factholic
        </div>
        <div className="flex flex-row items-center gap-6 sm:gap-10">
          <button
            type="button"
            className="text-[17px] text-[#A27C7A] hover:text-[#4A3333] font-bold transition-colors whitespace-nowrap hidden md:block cursor-pointer"
          >
            Как это работает
          </button>
          <button
            type="button"
            className="text-[17px] text-[#A27C7A] hover:text-[#4A3333] font-bold transition-colors whitespace-nowrap hidden md:block cursor-pointer"
          >
            Источники
          </button>
          <button
            type="button"
            className="text-[17px] text-[#A27C7A] hover:text-[#4A3333] font-bold transition-colors whitespace-nowrap hidden sm:block cursor-pointer"
          >
            Для редакций
          </button>
          <button
            type="button"
            className="px-6 py-2.5 outline-2 outline-[#4A3333] -outline-offset-1 rounded-full text-[17px] text-[#4A3333] hover:bg-[#4A3333] hover:text-white font-bold transition-all whitespace-nowrap cursor-pointer"
          >
            Войти
          </button>
        </div>
      </div>

      {/* Hero Body */}
      <div className="w-full flex flex-col gap-10 px-6 sm:px-12 lg:px-20 pt-4 z-10">
        {/* Headline Row */}
        <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="flex flex-col gap-5">
            <h1 className="text-6xl sm:text-8xl lg:text-[120px] leading-[0.95] text-[#4A3333] font-black tracking-[-3px] sm:tracking-[-4px]">
              Проверь
              <br />
              любое видео
            </h1>
            <p className="text-xl sm:text-2xl lg:text-[30px] text-[#A27C7A] font-extrabold max-w-[850px] leading-tight">
              Вставь ссылку — откроем плеер и разберём каждое утверждение
            </p>
          </div>

          {/* Stat Box */}
          <div className="flex flex-col items-start lg:items-end pt-2 sm:pt-4">
            <div className="text-lg sm:text-[22px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Сегодня проверено
            </div>
            <div className="text-4xl sm:text-5xl lg:text-[60px] text-[#4A3333] font-black tracking-[-1px] leading-tight">
              9 412
            </div>
            <div className="text-lg sm:text-[22px] text-[#A27C7A] font-extrabold whitespace-nowrap">
              видео
            </div>
          </div>
        </div>

        {/* Link Form */}
        <div className="flex flex-col gap-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-[760px] h-[72px] sm:h-[80px] shadow-[0px_10px_30px_#4A333314] flex flex-row gap-3.5 p-2 pl-6 sm:pl-7 items-center bg-[#FBF8F7] outline-2 outline-[#E3D9D6] -outline-offset-1 rounded-full transition-all focus-within:outline-[#4A3333]"
          >
            <Link2 className="w-6 h-6 text-[#A27C7A] shrink-0" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Вставь ссылку на видео…"
              className="text-base sm:text-[20px] flex-1 text-[#4A3333] placeholder-[#A27C7A] font-semibold bg-transparent border-none outline-none"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="h-full px-6 sm:px-8 bg-[#4A3333] hover:bg-[#392626] disabled:opacity-50 text-white rounded-full flex items-center gap-2.5 transition-all cursor-pointer shrink-0"
            >
              <span className="text-base sm:text-[19px] font-extrabold whitespace-nowrap">
                {isLoading ? "Проверяем..." : "Проверить"}
              </span>
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          </form>

          {/* Platforms Row */}
          <div className="flex flex-wrap items-center gap-2.5 pl-3">
            <span className="text-[15px] text-[#A27C7A] font-bold whitespace-nowrap mr-1">
              Работает с
            </span>

            {/* YouTube */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FBF8F7] rounded-full shadow-2xs">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="#E2353F">
                <path d="M8.96875 6.61719l-2.625-1.75q-0.21875-0.10938-0.4375 0-0.21875 0.10938-0.21875 0.38281l0 3.5q0 0.27344 0.21875 0.38281 0.10938 0.05469 0.21875 0.05469 0.10938 0 0.21875-0.05469l2.625-1.75q0.21875-0.16406 0.21875-0.38281 0-0.21875-0.21875-0.38281z" />
                <path d="M13.4 3.7q-.3-1.2-1.5-1.5C10.7 2 7 2 7 2s-3.7 0-4.9.2C.9 2.5.6 3.7.3 4.9 0 6.1 0 7 0 7s0 .9.3 2.1c.3 1.2.6 2.4 1.8 2.7 1.2.2 4.9.2 4.9.2s3.7 0 4.9-.2c1.2-.3 1.5-1.5 1.8-2.7.3-1.2.3-2.1.3-2.1s0-.9-.3-2.3zM6.5 8.8V5.2l3.2 1.8-3.2 1.8z" />
              </svg>
              <span className="text-[15px] text-[#4A3333] font-bold">YouTube</span>
            </div>

            {/* Shorts */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FBF8F7] rounded-full shadow-2xs">
              <div className="w-3.5 h-3.5 rounded-full bg-[#E0368A] flex items-center justify-center">
                <div className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white ml-0.5" />
              </div>
              <span className="text-[15px] text-[#4A3333] font-bold">Shorts</span>
            </div>

            {/* TikTok */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FBF8F7] rounded-full shadow-2xs">
              <span className="text-xs font-black text-[#4A3333]">d</span>
              <span className="text-[15px] text-[#4A3333] font-bold">TikTok</span>
            </div>

            {/* Facebook */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FBF8F7] rounded-full shadow-2xs">
              <span className="text-xs font-black text-[#1660D6]">f</span>
              <span className="text-[15px] text-[#4A3333] font-bold">Facebook</span>
            </div>

            {/* X */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FBF8F7] rounded-full shadow-2xs">
              <span className="text-xs font-black text-[#4A3333]">𝕏</span>
              <span className="text-[15px] text-[#4A3333] font-bold">X</span>
            </div>

            {/* Demo Trigger Buttons */}
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={() => handleUseDemo("video")}
                className="text-xs font-extrabold text-[#4A3333] bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                ★ Запустить демо из макета
              </button>
              <button
                type="button"
                onClick={() => handleUseDemo("text")}
                className="text-xs font-extrabold text-purple-900 bg-purple-200/80 hover:bg-purple-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                Или проверить текст статьи
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Spacer */}
      <div className="flex-1 min-h-[60px]" />

      {/* Floating Badges (From Pencil Export) */}
      <div className="hidden lg:block pointer-events-none">
        {/* Pill Lie */}
        <div className="absolute left-[720px] top-[540px] rotate-[6deg] shadow-[0px_8px_24px_#4A33331F] flex items-center gap-2.5 px-4 py-2.5 bg-[#FBF8F7] rounded-full z-20">
          <div className="w-3 h-3 bg-[#E2353F] rounded-full" />
          <span className="text-[17px] text-[#4A3333] font-extrabold">Ложь</span>
          <span className="text-[17px] text-[#A27C7A] font-extrabold">12%</span>
        </div>

        {/* Pill True */}
        <div className="absolute left-[1100px] top-[560px] -rotate-[5deg] shadow-[0px_8px_24px_#4A33331F] flex items-center gap-2.5 px-4 py-2.5 bg-[#FBF8F7] rounded-full z-20">
          <div className="w-3 h-3 bg-[#1DA57A] rounded-full" />
          <span className="text-[17px] text-[#4A3333] font-extrabold">Правда</span>
          <span className="text-[17px] text-[#A27C7A] font-extrabold">95%</span>
        </div>

        {/* Pill Disputed */}
        <div className="absolute left-[1180px] top-[410px] -rotate-[4deg] shadow-[0px_8px_24px_#4A33331F] flex items-center gap-2.5 px-4 py-2.5 bg-[#FBF8F7] rounded-full z-20">
          <div className="w-3 h-3 bg-[#FFC20E] rounded-full" />
          <span className="text-[17px] text-[#4A3333] font-extrabold">Спорно</span>
          <span className="text-[17px] text-[#A27C7A] font-extrabold">32%</span>
        </div>
      </div>

      {/* Emoji Crowd (Vector blobs with expressive cartoon faces) */}
      <div className="hidden lg:block absolute right-[40px] bottom-[40px] w-[580px] h-[360px] pointer-events-none z-0 opacity-90">
        {/* Blue Blob */}
        <div className="w-[180px] h-[180px] absolute left-[80px] top-[30px] bg-[#1660D6] rounded-full shadow-md">
          {/* Eyes & Mouth */}
          <div className="w-6 h-6 rounded-full bg-black/40 absolute left-10 top-12" />
          <div className="w-6 h-6 rounded-full bg-black/40 absolute right-10 top-12" />
          <div className="w-8 h-4 rounded-b-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-24" />
        </div>

        {/* Teal Blob */}
        <div className="w-[160px] h-[160px] absolute left-[220px] top-[10px] bg-[#0AA6C2] rounded-full shadow-md">
          <div className="w-5 h-5 rounded-full bg-black/40 absolute left-8 top-10" />
          <div className="w-5 h-5 rounded-full bg-black/40 absolute right-8 top-10" />
          <div className="w-7 h-3 rounded-b-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-20" />
        </div>

        {/* Green Blob */}
        <div className="w-[140px] h-[140px] absolute left-[350px] top-[70px] bg-[#1DA57A] rounded-full shadow-md">
          <div className="w-4 h-4 rounded-full bg-black/40 absolute left-7 top-9" />
          <div className="w-4 h-4 rounded-full bg-black/40 absolute right-7 top-9" />
          <div className="w-6 h-2 rounded-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-18" />
        </div>

        {/* Purple Blob */}
        <div className="w-[200px] h-[200px] absolute left-[400px] top-[120px] bg-[#6E1EF0] rounded-full shadow-md">
          <div className="w-6 h-7 rounded-full bg-black/40 absolute left-12 top-14" />
          <div className="w-6 h-7 rounded-full bg-black/40 absolute right-12 top-14" />
          <div className="w-10 h-5 rounded-b-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-28" />
        </div>

        {/* Red Blob */}
        <div className="w-[170px] h-[170px] absolute left-[0px] top-[160px] bg-[#E2353F] rounded-full shadow-md">
          <div className="w-5 h-5 rounded-full bg-black/40 absolute left-9 top-12" />
          <div className="w-5 h-5 rounded-full bg-black/40 absolute right-9 top-12" />
          <div className="w-10 h-2 rounded-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-24" />
        </div>

        {/* Pink Blob */}
        <div className="w-[180px] h-[180px] absolute left-[130px] top-[190px] bg-[#E0368A] rounded-full shadow-md">
          <div className="w-5 h-7 rounded-full bg-black/40 absolute left-11 top-12" />
          <div className="w-5 h-7 rounded-full bg-black/40 absolute right-11 top-12" />
          <div className="w-12 h-2.5 rounded-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-26" />
        </div>

        {/* Yellow Blob */}
        <div className="w-[160px] h-[160px] absolute left-[260px] top-[170px] bg-[#FFC20E] rounded-full shadow-md">
          <div className="w-5 h-6 rounded-full bg-black/40 absolute left-9 top-11" />
          <div className="w-5 h-6 rounded-full bg-black/40 absolute right-9 top-11" />
          <div className="w-12 h-6 rounded-b-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-22" />
        </div>

        {/* Orange Blob */}
        <div className="w-[150px] h-[150px] absolute left-[380px] top-[220px] bg-[#FF7A12] rounded-full shadow-md">
          <div className="w-4 h-5 rounded-full bg-black/40 absolute left-9 top-10" />
          <div className="w-4 h-5 rounded-full bg-black/40 absolute right-9 top-10" />
          <div className="w-5 h-5 rounded-full bg-black/40 absolute left-1/2 -translate-x-1/2 top-20" />
        </div>
      </div>

      {/* How It Works (3 Steps at the Bottom) */}
      <div className="w-full flex flex-col sm:flex-row gap-8 px-6 sm:px-12 lg:px-20 pb-12 pt-6 z-10">
        {/* Step 1 */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#FFC20E] flex items-center justify-center text-white text-xl font-black shrink-0 shadow-xs">
            1
          </div>
          <div className="flex flex-col">
            <div className="text-[18px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Вставь ссылку
            </div>
            <div className="text-[15px] text-[#A27C7A] font-semibold whitespace-nowrap">
              из любой соцсети
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#0AA6C2] flex items-center justify-center text-white text-xl font-black shrink-0 shadow-xs">
            2
          </div>
          <div className="flex flex-col">
            <div className="text-[18px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Смотри в плеере
            </div>
            <div className="text-[15px] text-[#A27C7A] font-semibold whitespace-nowrap">
              с метками на таймлайне
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#E0368A] flex items-center justify-center text-white text-xl font-black shrink-0 shadow-xs">
            3
          </div>
          <div className="flex flex-col">
            <div className="text-[18px] text-[#4A3333] font-extrabold whitespace-nowrap">
              Читай оценки
            </div>
            <div className="text-[15px] text-[#A27C7A] font-semibold whitespace-nowrap">
              за, против и источники
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
