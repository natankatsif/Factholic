import React, { useState } from "react";
import { Link2, ArrowRight } from "lucide-react";

export const DEMO_URL = "https://www.youtube.com/watch?v=MOCK123";

interface LinkInputCardProps {
  onCheck: (val: string, isUrl: boolean) => void;
  isLoading?: boolean;
}

export function LinkInputCard({ onCheck, isLoading }: LinkInputCardProps) {
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
    <div className="w-fit max-w-full flex flex-col gap-4 items-start shrink-0 z-10">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[740px] lg:w-[760px] h-[72px] sm:h-[80px] shadow-[0px_10px_30px_#4A333314] flex flex-row gap-3.5 p-2 pl-6 sm:pl-7 items-center bg-[#FBF8F7] outline-2 outline-[#E3D9D6] -outline-offset-1 rounded-full transition-all focus-within:outline-[#4A3333]"
      >
        <Link2 className="w-6 h-6 text-[#A27C7A] shrink-0" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Вставь ссылку на видео…"
          className="text-lg sm:text-[20px] flex-1 text-[#4A3333] placeholder-[#A27C7A] font-semibold bg-transparent border-none outline-none leading-normal min-w-0"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="h-full px-6 sm:px-8 bg-[#4A3333] hover:bg-[#392626] disabled:opacity-50 text-white rounded-full flex items-center gap-2.5 transition-all cursor-pointer shrink-0"
        >
          <span className="text-base sm:text-[19px] font-extrabold whitespace-nowrap leading-normal">
            {isLoading ? "Проверяем..." : "Проверить"}
          </span>
          <ArrowRight className="w-5 h-5 text-white" />
        </button>
      </form>

      {/* Platforms and Quick Triggers */}
      <div className="flex flex-wrap items-center gap-2 pl-2 sm:pl-3">
        <span className="text-[15px] leading-normal text-[#A27C7A] font-bold whitespace-nowrap mr-1">
          Работает с
        </span>

        {/* YouTube */}
        <div className="flex items-center gap-1.5 p-[6px_12px] bg-[#FBF8F7] rounded-full shadow-2xs">
          <svg className="w-4 h-4" viewBox="0 0 14 14" fill="#E2353F">
            <path d="M8.96875 6.61719l-2.625-1.75q-0.21875-0.10938-0.4375 0-0.21875 0.10938-0.21875 0.38281l0 3.5q0 0.27344 0.21875 0.38281 0.10938 0.05469 0.21875 0.05469 0.10938 0 0.21875-0.05469l2.625-1.75q0.21875-0.16406 0.21875-0.38281 0-0.21875-0.21875-0.38281z" />
            <path d="M13.4 3.7q-.3-1.2-1.5-1.5C10.7 2 7 2 7 2s-3.7 0-4.9.2C.9 2.5.6 3.7.3 4.9 0 6.1 0 7 0 7s0 .9.3 2.1c.3 1.2.6 2.4 1.8 2.7 1.2.2 4.9.2 4.9.2s3.7 0 4.9-.2c1.2-.3 1.5-1.5 1.8-2.7.3-1.2.3-2.1.3-2.1s0-.9-.3-2.3zM6.5 8.8V5.2l3.2 1.8-3.2 1.8z" />
          </svg>
          <span className="text-[14px] leading-normal text-[#4A3333] font-bold">
            YouTube
          </span>
        </div>

        {/* Shorts */}
        <div className="flex items-center gap-1.5 p-[6px_12px] bg-[#FBF8F7] rounded-full shadow-2xs">
          <div className="w-3.5 h-3.5 rounded-full bg-[#E0368A] flex items-center justify-center">
            <div className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white ml-0.5" />
          </div>
          <span className="text-[14px] leading-normal text-[#4A3333] font-bold">
            Shorts
          </span>
        </div>

        {/* TikTok */}
        <div className="flex items-center gap-1.5 p-[6px_12px] bg-[#FBF8F7] rounded-full shadow-2xs">
          <span className="text-xs font-black text-[#4A3333]">d</span>
          <span className="text-[14px] leading-normal text-[#4A3333] font-bold">
            TikTok
          </span>
        </div>

        {/* Facebook */}
        <div className="flex items-center gap-1.5 p-[6px_12px] bg-[#FBF8F7] rounded-full shadow-2xs">
          <span className="text-xs font-black text-[#1660D6]">f</span>
          <span className="text-[14px] leading-normal text-[#4A3333] font-bold">
            Facebook
          </span>
        </div>

        {/* X */}
        <div className="flex items-center gap-1.5 p-[6px_12px] bg-[#FBF8F7] rounded-full shadow-2xs">
          <span className="text-xs font-black text-[#4A3333]">𝕏</span>
          <span className="text-[14px] leading-normal text-[#4A3333] font-bold">
            X
          </span>
        </div>

        {/* Demo Buttons */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            type="button"
            onClick={() => handleUseDemo("video")}
            className="text-xs font-extrabold text-[#4A3333] bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            ★ Демо из макета
          </button>
          <button
            type="button"
            onClick={() => handleUseDemo("text")}
            className="text-xs font-extrabold text-purple-900 bg-purple-200/80 hover:bg-purple-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            Текст
          </button>
        </div>
      </div>
    </div>
  );
}
