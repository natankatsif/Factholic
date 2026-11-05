"use client";

import Link from "next/link";
import { useSiteText } from "../i18n/site";

/** Страница 404 на языке посетителя: стандартная страница Next только на английском */
export default function NotFound() {
  const t = useSiteText();
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-[#F1EBE9] px-6 text-center text-[#4A3333]">
      <span className="text-2xl font-black">{t.common.notFound}</span>
      <Link
        href="/"
        className="rounded-full bg-[#4A3333] px-5 py-2.5 text-sm font-extrabold text-white no-underline hover:bg-[#362424]"
      >
        {t.common.toHome}
      </Link>
    </div>
  );
}
