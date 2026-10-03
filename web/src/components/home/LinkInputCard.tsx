import React, { useState } from "react";

export interface LinkInputCardProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
  defaultValue?: string;
}

export function LinkInputCard({
  onCheck,
  isLoading = false,
  defaultValue = "",
}: LinkInputCardProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

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
      {/* Link 2 Lucide Icon */}
      <svg
        data-pencil-name="Link Icon"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="box-border w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#A27C7A]"
      >
        <path
          d="M3.82129 3.51367q-0.11279 0.01367-0.2085 0.02735-0.18115 0.01367-0.42041 0.07861-0.23926 0.06152-0.42041 0.1333-0.81348 0.33496-1.37402 1.0083-0.55713 0.66992-0.73828 1.53809-0.19824 0.93994 0.11621 1.84912 0.31445 0.90918 1.05957 1.52441 0.62891 0.5332 1.39795 0.71436 0.29395 0.07178 0.4751 0.08545 0.18457 0.01367 0.85449 0.01367l0.84082 0 0.09912-0.04102q0.19482-0.09912 0.27002-0.28711 0.07861-0.19141 0.02734-0.39306-0.04785-0.20166-0.21533-0.32813-0.08203-0.05811-0.14697-0.07178-0.06152-0.01367-0.25635-0.02734l-0.63232-0.01367q-0.81006-0.01367-0.9502-0.04102-0.75879-0.1709-1.26123-0.7417-0.40674-0.46484-0.5332-1.08007-0.04102-0.18115-0.04102-0.46143 0-0.28027 0.04102-0.46143 0.11279-0.54688 0.44092-0.96728 0.33154-0.42041 0.82031-0.65625 0.25293-0.14014 0.5332-0.19824 0.14014-0.02734 0.96387-0.04102l0.81347-0.01367 0.1128-0.04102q0.2085-0.11279 0.29053-0.32129 0.08545-0.21191 0.00683-0.42041-0.0752-0.21191-0.28369-0.3247l-0.09912-0.04102-0.76904-0.01367q-0.75537 0-0.81348 0.01367z m4.78857 0q-0.12646 0.02734-0.23925 0.1333-0.10938 0.10596-0.16748 0.23242-0.06836 0.2085 0.01367 0.42725 0.08545 0.21533 0.29394 0.31445l0.1128 0.04102 0.81347 0.01367q0.82373 0.01367 0.96387 0.04102 0.68701 0.15381 1.16894 0.64599 0.48535 0.48877 0.62549 1.17578 0.04102 0.18115 0.04102 0.46143 0 0.28027-0.04102 0.46143-0.12646 0.61523-0.5332 1.08007-0.50244 0.5708-1.26123 0.7417-0.14014 0.02734-0.9502 0.04102l-0.63232 0.01367q-0.19482 0.01367-0.25977 0.02734-0.06152 0.01367-0.14355 0.07178-0.16748 0.12646-0.21875 0.32813-0.04785 0.20166 0.02734 0.39306 0.07861 0.18799 0.27344 0.28711l0.09912 0.04102 0.84082 0q0.66992 0 0.85108-0.01367 0.18457-0.01367 0.47851-0.08545 0.4751-0.11279 0.92285-0.37598 0.44775-0.2666 0.78614-0.63232 0.61523-0.66992 0.83056-1.52442 0.21875-0.85449 0-1.70898-0.21533-0.85449-0.83056-1.52442-0.32471-0.35205-0.75196-0.60839-0.42725-0.25977-0.88867-0.38624-0.29394-0.08545-0.49902-0.09912-0.20166-0.01367-0.84424-0.02734-0.81006 0-0.88184 0.01367z m-4.1289 2.93946q-0.23926 0.08545-0.34522 0.3247-0.10254 0.23584-0.00683 0.46143 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.40674 0.03418l2.15674 0 2.15674 0q0.32129 0 0.40332-0.03418 0.08545-0.0376 0.16748-0.11963 0.08545-0.08545 0.1333-0.18799 0.05127-0.10596 0.05127-0.23242 0-0.12646-0.04102-0.23926-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-2.47803 0q-2.47803 0-2.53271 0.02735z"
          fill="#A27C7A"
        />
      </svg>

      {/* Input Field */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Вставь ссылку на видео…"
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
