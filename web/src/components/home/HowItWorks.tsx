import React from "react";
import { useSiteText } from "../../i18n/site";

const STEP_COLORS = ["#FFC20E", "#0AA6C2", "#E0368A"];

/**
 * На десктопе шаги стоят внизу слева, а справа внизу — толпа смайликов (EmojiCrowd).
 * Чтобы они не пересекались, ширина ряда ограничена: экран минус видимая часть толпы до красного смайлика
 * (620px × --crowd-scale), зазор 24px, отступ 80px и поле по краям, когда экран шире контейнера 1440px.
 * Не влезают в одну строку — переносятся на следующую, а не залезают под смайлики.
 */
export function HowItWorks() {
  const t = useSiteText();
  return (
    <div
      data-pencil-name="How It Works"
      className="box-border flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-4 lg:max-w-[calc(100vw_-_620px*var(--crowd-scale)_-_104px_-_max(0px,(100vw_-_1440px)/2))] lg:gap-x-6"
    >
      {t.home.steps.map((s, index) => (
        <div
          key={s.title}
          data-pencil-name={`Step ${index + 1}`}
          className="flex items-center gap-3 sm:gap-[14px]"
        >
          <div
            data-pencil-name="Num"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-[44px] sm:w-[44px]"
            style={{ backgroundColor: STEP_COLORS[index] }}
          >
            <span className="text-lg font-black leading-normal text-white sm:text-[20px]">{index + 1}</span>
          </div>
          <div data-pencil-name="Text" className="flex flex-col">
            <span className="whitespace-nowrap text-base font-extrabold leading-normal text-[#4A3333] sm:text-[18px]">
              {s.title}
            </span>
            <span className="text-xs font-semibold leading-snug text-[#A27C7A] sm:text-[15px] lg:max-w-[140px] lg:[text-wrap:balance]">
              {s.sub}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
