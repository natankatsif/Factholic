import React from "react";

const STEPS = [
  { n: 1, color: "#FFC20E", title: "Вставь тезис", sub: "или ссылку на видео / новость" },
  { n: 2, color: "#0AA6C2", title: "Разбор аргументов", sub: "факты, таймлайн и контекст" },
  { n: 3, color: "#E0368A", title: "Читай вердикт", sub: "за, против и первоисточники" },
];

/**
 * На десктопе шаги стоят внизу слева, а справа внизу — толпа смайликов (EmojiCrowd).
 * Чтобы они не пересекались, ширина ряда ограничена: экран минус видимая часть толпы до красного смайлика
 * (620px × --crowd-scale), зазор 24px, отступ 80px и поле по краям, когда экран шире контейнера 1440px.
 * Не влезают в одну строку — переносятся на следующую, а не залезают под смайлики.
 */
export function HowItWorks() {
  return (
    <div
      data-pencil-name="How It Works"
      className="box-border flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-4 lg:max-w-[calc(100vw_-_620px*var(--crowd-scale)_-_104px_-_max(0px,(100vw_-_1440px)/2))] lg:gap-x-6"
    >
      {STEPS.map((s) => (
        <div key={s.n} data-pencil-name={`Step ${s.n}`} className="flex items-center gap-3 sm:gap-[14px]">
          <div
            data-pencil-name="Num"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-[44px] sm:w-[44px]"
            style={{ backgroundColor: s.color }}
          >
            <span className="text-lg font-black leading-normal text-white sm:text-[20px]">{s.n}</span>
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
