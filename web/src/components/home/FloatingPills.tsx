import React from "react";
import { useSiteText, type SiteDictionary } from "../../i18n/site";

/**
 * Декоративные плашки поверх толпы смайликов. Координаты и постоянный наклон — относительно EmojiCrowd (740×524).
 * Наклон задан сразу на контейнере (без скачков и задержек при загрузке страницы).
 * Внутри — плавное вертикальное покачивание (pill-bob) с отрицательным сдвигом фазы (сразу в движении).
 */
const PILLS: Array<{
  name: string;
  label: keyof SiteDictionary["home"]["pills"];
  value: string;
  dot: string;
  wrapperClass: string;
  floatAnimation: string;
}> = [
  {
    name: "Pill Lie",
    label: "lie",
    value: "12%",
    dot: "#E2353F",
    wrapperClass: "left-[-20px] top-[192px] [transform:rotate(6deg)] [transform-origin:top_left]",
    floatAnimation: "pill-bob 4.2s ease-in-out infinite 0s",
  },
  {
    name: "Pill True",
    label: "truth",
    value: "95%",
    dot: "#1DA57A",
    wrapperClass: "left-[380px] top-[215px] [transform:rotate(-5deg)] [transform-origin:top_left]",
    floatAnimation: "pill-bob 4.8s ease-in-out infinite -1.6s",
  },
  {
    name: "Pill Disputed",
    label: "disputed",
    value: "32%",
    dot: "#FFC20E",
    wrapperClass: "left-[450px] top-[40px] [transform:rotate(-4deg)] [transform-origin:top_left]",
    floatAnimation: "pill-bob 4.5s ease-in-out infinite -3.0s",
  },
];

export function FloatingPills() {
  const t = useSiteText();
  return (
    <>
      {PILLS.map((p) => (
        <div
          key={p.name}
          data-pencil-name={p.name}
          className={`absolute z-10 hidden w-fit lg:block ${p.wrapperClass} pointer-events-none`}
        >
          <div
            style={{ animation: p.floatAnimation }}
            className="flex w-fit items-center gap-[10px] rounded-[100px] bg-[#FBF8F7] p-[10px_18px_10px_12px] [box-shadow:0px_8px_24px_#4A33331F] cursor-default select-none pointer-events-none"
          >
            <div className="h-[12px] w-[12px] shrink-0 rounded-full" style={{ backgroundColor: p.dot }} />
            <div className="whitespace-nowrap text-[17px] font-extrabold leading-normal text-[#4A3333]">
              {t.home.pills[p.label]}
            </div>
            <div className="whitespace-nowrap text-[17px] font-extrabold leading-normal text-[#A27C7A]">
              {p.value}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
