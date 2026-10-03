import React, { useState } from "react";

export interface LinkInputCardProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
  onTypingChange?: (isTyping: boolean, text: string) => void;
}

export function LinkInputCard({ onCheck, isLoading = false, onTypingChange }: LinkInputCardProps) {
  const [inputValue, setInputValue] = useState("");
  const typingTimerRef = React.useRef<NodeJS.Timeout>();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onTypingChange?.(true, val);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingChange?.(false, val);
    }, 1200);
  };

  const handleFocus = () => {
    onTypingChange?.(true, inputValue);
  };

  const handleBlur = () => {
    onTypingChange?.(false, inputValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const isUrl =
      /^https?:\/\//i.test(trimmed) ||
      trimmed.includes("youtu.be") ||
      trimmed.includes("tiktok.com") ||
      trimmed.includes("facebook.com") ||
      trimmed.includes("twitter.com") ||
      trimmed.includes("x.com");

    onCheck(trimmed, isUrl);
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-pencil-name="Link Input"
      className="box-border w-full max-w-[760px] h-[58px] sm:h-[66px] xl:h-[72px] shrink-0 [box-shadow:0px_10px_30px_#4A333314] flex flex-row gap-3 sm:gap-[14px] p-1.5 sm:p-2 pl-4 sm:p-[6px_6px_6px_24px] justify-start items-center bg-[#FBF8F7] [outline:2px_solid_#E3D9D6] [outline-offset:-1px] rounded-[100px] transition-all focus-within:[outline-color:#4A3333]"
    >
      {/* Thesis / Claim Sparkle Icon */}
      <svg
        data-pencil-name="Thesis Icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="box-border w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#A27C7A]"
      >
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>

      {/* Input Field */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Вставь тезис или новость для проверки…"
        data-pencil-name="Placeholder"
        className="text-sm sm:text-lg xl:text-[20px] leading-normal box-border flex-1 text-[#4A3333] placeholder-[#A27C7A] font-semibold text-left bg-transparent border-none outline-none min-w-0"
      />

      {/* Check Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        data-pencil-name="Check Button"
        className="box-border w-fit shrink-0 h-full flex flex-row gap-1.5 sm:gap-[10px] px-3.5 sm:px-7 xl:p-[0px_30px] justify-center items-center bg-[#4A3333] hover:bg-[#362424] active:scale-[0.98] rounded-[100px] border-none transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-white font-extrabold text-sm sm:text-base xl:text-[19px]">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Проверяем…
          </span>
        ) : (
          <>
            <span
              data-pencil-name="Label"
              className="text-sm sm:text-base xl:text-[19px] leading-normal box-border text-[#FFFFFF] font-extrabold text-left whitespace-nowrap"
            >
              Проверить
            </span>
            <svg
              data-pencil-name="Arrow"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="box-border w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white"
            >
              <path
                d="M6.90088 2.35156q-0.18115 0.02734-0.32129 0.16748-0.11279 0.11279-0.14697 0.28028-0.03418 0.16748 0.02051 0.32129 0.02734 0.08545 0.25976 0.3247 0.23242 0.23584 1.36377 1.37061 1.58252 1.58252 1.58252 1.59619 0 0.01367-3.45557 0.01367l-3.44531 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.53321 0.03418l3.01123 0q3.42822 0 3.42822 0.01367 0 0.01367-1.58252 1.59619-1.13135 1.13477-1.36377 1.37402-0.23242 0.23584-0.25976 0.3213-0.05469 0.15381-0.02051 0.32128 0.03418 0.16748 0.14697 0.28028 0.18115 0.18115 0.42041 0.18115l0.04102 0q0.11279 0 0.19824-0.05469 0.14014-0.09912 0.51611-0.46484l1.68164-1.67822q2.1123-2.10205 2.15332-2.18409 0.07178-0.12646 0.07178-0.28027 0-0.15381-0.07178-0.28027-0.04102-0.08203-2.1499-2.18067-2.10547-2.10205-2.17725-2.13623-0.06836-0.0376-0.23584-0.06494-0.04102 0-0.12646 0.01367z"
                fill="#FFFFFF"
              />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
