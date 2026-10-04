import React from "react";
import { ArrowUpRight, Github } from "lucide-react";

export const GITHUB_URL = "https://github.com/natankatsif/factholic";

/** Лавровая ветвь (своя, не эмодзи): стебель и заострённые листья по очереди наружу и внутрь */
const LAUREL_STEM = "M12.0 30.5Q1.0 21.0 5.5 2.5";
const LAUREL_LEAVES =
  "M9.58 28.09Q6.76 25.31 3.09 26.81Q5.91 29.58 9.58 28.09ZM9.58 28.09Q10.97 25.35 8.98 23.02Q7.59 25.76 9.58 28.09ZM7.33 24.95Q5.20 21.93 1.58 22.68Q3.71 25.71 7.33 24.95ZM7.33 24.95Q9.06 22.67 7.62 20.19Q5.89 22.47 7.33 24.95ZM5.68 21.46Q4.24 18.34 0.81 18.43Q2.25 21.55 5.68 21.46ZM5.68 21.46Q7.64 19.66 6.74 17.16Q4.78 18.96 5.68 21.46ZM4.64 17.62Q3.82 14.55 0.68 14.10Q1.50 17.16 4.64 17.62ZM4.64 17.62Q6.71 16.29 6.28 13.87Q4.21 15.20 4.64 17.62ZM4.21 13.42Q3.88 10.53 1.10 9.68Q1.43 12.57 4.21 13.42ZM4.21 13.42Q6.26 12.50 6.21 10.25Q4.15 11.17 4.21 13.42ZM4.38 8.87Q4.43 6.23 2.03 5.13Q1.98 7.77 4.38 8.87ZM4.38 8.87Q6.35 8.29 6.56 6.25Q4.60 6.83 4.38 8.87ZM4.95 5.05Q7.12 3.07 5.98 0.36Q3.80 2.34 4.95 5.05Z";

function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 13 31"
      aria-hidden
      className={`h-[26px] w-[11px] shrink-0 text-[#C98A00] sm:h-[30px] sm:w-[13px] ${flip ? "-scale-x-100" : ""}`}
    >
      <path d={LAUREL_STEM} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
      <path d={LAUREL_LEAVES} fill="currentColor" />
    </svg>
  );
}

/**
 * Плашка-анонс над заголовком главной: наградной знак «1 место» в лавровых ветвях (как у наград
 * Product Hunt) и ссылка на код на GitHub.
 */
export function HackathonPill() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      data-pencil-name="Hackathon Pill"
      className="group flex w-fit max-w-full items-center gap-2.5 rounded-full bg-[#FBF8F7] py-1 pl-3 pr-3.5 text-[#4A3333] no-underline [box-shadow:0px_2px_10px_rgba(74,51,51,0.08)] [outline:1.5px_solid_#E2D7D4] [outline-offset:-1px] transition-all duration-200 hover:-translate-y-px hover:[box-shadow:0px_8px_20px_rgba(74,51,51,0.14)] sm:gap-3 sm:pl-3.5 sm:pr-4"
    >
      <span className="flex shrink-0 items-center gap-1">
        <Laurel />
        <span className="flex flex-col items-center px-0.5 leading-none">
          <span className="text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#A27C7A] sm:text-[9.5px]">
            BEST Minds Hackathon
          </span>
          <span className="mt-[3px] text-[14px] font-black tracking-[-0.2px] sm:text-[16px]">1 место</span>
        </span>
        <Laurel flip />
      </span>
      <span aria-hidden className="h-6 w-px shrink-0 bg-[#E2D7D4]" />
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-extrabold text-[#A27C7A] transition-colors group-hover:text-[#4A3333] sm:text-[13px]">
        <Github className="h-4 w-4" strokeWidth={2.3} />
        <span className="hidden sm:inline">Код на GitHub</span>
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </span>
    </a>
  );
}
