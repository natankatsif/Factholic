"use client";

import { useLocale } from "./LocaleProvider";
import { LOCALE_NAMES, LOCALES, parseLocale } from "./locale";

/**
 * Переключатель языка для шапок сайта, отчёта и кабинета. Выбор запоминается в cookie (LocaleProvider).
 * Выпадающий список, а не три кнопки: в шапке на телефоне нет места.
 */
export function LanguageSwitcher({ label, className = "" }: { label: string; className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <select
      aria-label={label}
      title={label}
      value={locale}
      onChange={(event) => {
        const next = parseLocale(event.target.value);
        if (next) setLocale(next);
      }}
      className={`h-8 w-[52px] shrink-0 cursor-pointer rounded-full border-none bg-transparent px-1.5 text-[13px] font-extrabold uppercase text-[#A27C7A] outline-none transition-colors hover:bg-[#E8DFDC] hover:text-[#4A3333] ${className}`}
    >
      {LOCALES.map((item) => (
        <option key={item} value={item} lang={item} title={LOCALE_NAMES[item]}>
          {item.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
