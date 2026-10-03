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
    <div className="w-fit max-w-full flex flex-col gap-2.5 items-start shrink-0 z-10">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[480px] lg:w-[520px] h-[48px] sm:h-[52px] shadow-[0px_6px_20px_#4A333312] flex flex-row gap-2.5 p-1 pl-4 sm:pl-5 items-center bg-[#FBF8F7] outline-2 outline-[#E3D9D6] -outline-offset-1 rounded-full transition-all focus-within:outline-[#4A3333]"
      >
        <Link2 className="w-4 h-4 text-[#A27C7A] shrink-0" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Вставь ссылку на видео…"
          className="text-sm sm:text-[15px] flex-1 text-[#4A3333] placeholder-[#A27C7A] font-semibold bg-transparent border-none outline-none leading-normal min-w-0"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="h-full px-4 sm:px-5 bg-[#4A3333] hover:bg-[#392626] disabled:opacity-50 text-white rounded-full flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <span className="text-[13px] sm:text-[14px] font-extrabold whitespace-nowrap leading-normal">
            {isLoading ? "Проверяем..." : "Проверить"}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </button>
      </form>

      {/* Platforms and Quick Triggers */}
      <div className="flex flex-wrap items-center gap-1.5 pl-1">
        <span className="text-[12px] sm:text-[13px] leading-normal text-[#A27C7A] font-bold whitespace-nowrap mr-0.5">
          Работает с
        </span>

        {/* YouTube */}
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#FBF8F7] rounded-full shadow-2xs">
          <svg className="w-3 h-3" viewBox="0 0 14 14" fill="#E2353F">
            <path d="M8.96875 6.61719l-2.625-1.75q-0.21875-0.10938-0.4375 0-0.21875 0.10938-0.21875 0.38281l0 3.5q0 0.27344 0.21875 0.38281 0.10938 0.05469 0.21875 0.05469 0.10938 0 0.21875-0.05469l2.625-1.75q0.21875-0.16406 0.21875-0.38281 0-0.21875-0.21875-0.38281z" />
            <path d="M13.4 3.7q-.3-1.2-1.5-1.5C10.7 2 7 2 7 2s-3.7 0-4.9.2C.9 2.5.6 3.7.3 4.9 0 6.1 0 7 0 7s0 .9.3 2.1c.3 1.2.6 2.4 1.8 2.7 1.2.2 4.9.2 4.9.2s3.7 0 4.9-.2c1.2-.3 1.5-1.5 1.8-2.7.3-1.2.3-2.1.3-2.1s0-.9-.3-2.3zM6.5 8.8V5.2l3.2 1.8-3.2 1.8z" />
          </svg>
          <span className="text-[12px] leading-normal text-[#4A3333] font-bold">
            YouTube
          </span>
        </div>

        {/* Shorts */}
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#FBF8F7] rounded-full shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E0368A] flex items-center justify-center">
            <div className="w-0 h-0 border-y-[2px] border-y-transparent border-l-[3.5px] border-l-white ml-0.5" />
          </div>
          <span className="text-[12px] leading-normal text-[#4A3333] font-bold">
            Shorts
          </span>
        </div>

        {/* TikTok */}
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#FBF8F7] rounded-full shadow-2xs">
          <svg className="w-3 h-3" viewBox="0 0 14 14" fill="#4A3333">
            <path d="M12.25 4.15625q-1.09375 0-1.85938-0.76563-0.76563-0.76563-0.76562-1.85937 0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672l-2.1875 0q-0.16406 0-0.30078 0.13672-0.13672 0.13672-0.13672 0.30078l0 7q0 0.38281-0.27344 0.71094-0.27344 0.32813-0.65625 0.38281-0.38281 0.05469-0.73828-0.16406-0.35547-0.21875-0.46484-0.60157-0.10938-0.38281 0.05469-0.76562 0.16406-0.38281 0.49218-0.54688 0.27344-0.10938 0.27344-0.38281l0-2.29687q0-0.21875-0.16406-0.32813-0.16406-0.10938-0.32813-0.10937-1.09375 0.21875-1.91406 0.875-0.82031 0.65625-1.23047 1.64062-0.41016 0.98438-0.27344 2.07813 0.13672 1.09375 0.76563 1.9414 0.62891 0.84766 1.58594 1.3125 0.95703 0.46484 2.02343 0.41016 1.06641-0.05469 1.96875-0.62891 0.90234-0.57422 1.42188-1.5039 0.51953-0.92969 0.51953-2.02344l0-1.96875q1.25781 0.65625 2.625 0.65625 0.16406 0 0.30078-0.13672 0.13672-0.13672 0.13672-0.30078l0-2.1875q0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672z" />
          </svg>
          <span className="text-[12px] leading-normal text-[#4A3333] font-bold">
            TikTok
          </span>
        </div>

        {/* Facebook */}
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#FBF8F7] rounded-full shadow-2xs">
          <svg className="w-3 h-3" viewBox="0 0 14 14" fill="#1660D6">
            <path d="M12.6875 7q0-1.53125-0.76563-2.84375-0.76563-1.3125-2.07812-2.07813-1.3125-0.76563-2.84375-0.76562-1.53125 0-2.84375 0.76562-1.3125 0.76563-2.07813 2.07813-0.76563 1.3125-0.76562 2.84375 0 1.53125 0.76562 2.84375 0.76563 1.3125 2.07813 2.07813 1.3125 0.76563 2.84375 0.76562 1.53125 0 2.84375-0.76562 1.3125-0.76563 2.07813-2.07813 0.76563-1.3125 0.76562-2.84375z m-5.25 4.8125l0-3.5 1.3125 0q0.16406 0 0.30078-0.13672 0.13672-0.13672 0.13672-0.30078 0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672l-1.3125 0 0-1.3125q0-0.38281 0.24609-0.62891 0.24609-0.24609 0.62891-0.24609l0.875 0q0.16406 0 0.30078-0.13672 0.13672-0.13672 0.13672-0.30078 0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672l-0.875 0q-0.71094 0-1.23047 0.51953-0.51953 0.51953-0.51953 1.23047l0 1.3125-1.3125 0q-0.16406 0-0.30078 0.13672-0.13672 0.13672-0.13672 0.30078 0 0.16406 0.13672 0.30078 0.13672 0.13672 0.30078 0.13672l1.3125 0 0 3.5q-1.25781-0.16406-2.26953-0.84766-1.01172-0.68359-1.58594-1.80468-0.57422-1.12109-0.51953-2.37891 0.05469-1.25781 0.71094-2.32422 0.65625-1.06641 1.75-1.66797 1.09375-0.60156 2.35156-0.60156 1.25781 0 2.35156 0.60156 1.09375 0.60156 1.75 1.66797 0.65625 1.06641 0.71094 2.32422 0.05469 1.25781-0.51953 2.37891-0.57422 1.12109-1.58594 1.80468-1.01172 0.68359-2.26953 0.84766z" />
          </svg>
          <span className="text-[12px] leading-normal text-[#4A3333] font-bold">
            Facebook
          </span>
        </div>

        {/* X */}
        <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#FBF8F7] rounded-full shadow-2xs">
          <svg className="w-3 h-3" viewBox="0 0 14 14" fill="#4A3333">
            <path d="M13.50781 3.77344q-0.10937-0.27344-0.38281-0.27344l-1.64062 0q-0.32813-0.54688-0.82032-0.875-0.49219-0.32813-1.12109-0.41016-0.62891-0.08203-1.20313 0.10938-0.57422 0.19141-0.95703 0.60156-0.38281 0.41016-0.60156 0.875-0.21875 0.46484-0.21875 1.01172l0 0.32813q-0.98438-0.27344-2.02344-0.875-0.76563-0.4375-1.47656-1.03907-0.49219-0.38281-0.54687-0.49218-0.21875-0.16406-0.46485-0.08204-0.24609 0.08203-0.30078 0.35547-0.32813 1.75 0.05469 3.28125 0.32813 1.20313 1.03906 2.13281 0.54688 0.76563 1.3125 1.3125-0.49219 0.60156-1.3125 1.03907-0.4375 0.27344-0.82031 0.38281-0.16406 0.10938-0.2461 0.30078-0.08203 0.19141 0.05469 0.41016 0.13672 0.21875 0.57422 0.4375 0.76563 0.38281 1.96875 0.38281 1.91406 0 3.55469-0.90234 1.64063-0.90234 2.67969-2.46094 1.03906-1.55859 1.20312-3.41797l1.64063-1.64063q0.16406-0.21875 0.05468-0.49218z" />
          </svg>
          <span className="text-[12px] leading-normal text-[#4A3333] font-bold">
            X
          </span>
        </div>

        {/* Demo Buttons */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            type="button"
            onClick={() => handleUseDemo("video")}
            className="text-2xs font-extrabold text-[#4A3333] bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            ★ Демо из макета
          </button>
          <button
            type="button"
            onClick={() => handleUseDemo("text")}
            className="text-2xs font-extrabold text-purple-900 bg-purple-200/80 hover:bg-purple-300 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            Текст
          </button>
        </div>
      </div>
    </div>
  );
}
