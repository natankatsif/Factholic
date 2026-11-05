/**
 * Языки интерфейса. Один механизм на сайт и кабинет: выбор лежит в cookie, сервер читает его при отрисовке
 * (страница сразу приходит на нужном языке), клиент — через useLocale (LocaleProvider.tsx).
 * Этот файл без React и без серверных API: его можно импортировать откуда угодно.
 */
export const LOCALES = ["ru", "ro", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "factholic_locale";
/** Год: выбор языка не должен слетать между визитами */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Теги для дат и чисел (Intl, toLocaleDateString) */
export const LOCALE_TAGS: Record<Locale, string> = { ru: "ru-RU", ro: "ro-RO", en: "en-GB" };
/** Для og:locale */
export const OG_LOCALES: Record<Locale, string> = { ru: "ru_RU", ro: "ro_RO", en: "en_GB" };
/** Подписи в переключателе: каждый язык назван на нём самом */
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", ro: "Română", en: "English" };

export function parseLocale(value: string | undefined | null): Locale | null {
  return LOCALES.find((locale) => locale === value) ?? null;
}

/** Первый подходящий язык из заголовка Accept-Language: «ro-MD,ro;q=0.9,en;q=0.8» → ro */
export function localeFromHeader(header: string | undefined | null): Locale | null {
  for (const part of header?.split(",") ?? []) {
    const locale = parseLocale(part.trim().slice(0, 2).toLowerCase());
    if (locale) return locale;
  }
  return null;
}

/** Текущий язык вне React (создание проверки в lib/jobs.ts). Только в браузере; на сервере — язык по умолчанию */
export function currentLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(`${LOCALE_COOKIE}=`));
  return parseLocale(cookie?.split("=")[1]) ?? parseLocale(document.documentElement.lang) ?? DEFAULT_LOCALE;
}

/** Формы слова для Intl.PluralRules: в ru нужны one / few / many, в ro — one / few / other, в en — one / other */
export interface PluralForms {
  one: string;
  few: string;
  many: string;
  other: string;
}

/** Нужная форма слова для числа по правилам языка */
export function pluralWord(count: number, forms: PluralForms, locale: Locale): string {
  const form = new Intl.PluralRules(locale).select(count);
  return form === "one" || form === "few" || form === "many" ? forms[form] : forms.other;
}

/** Формы для английского: 1 source, 2 sources */
export function enForms(one: string, other: string): PluralForms {
  return { one, few: other, many: other, other };
}

/** Формы для румынского: 1 sursă, 2 surse, 20 de surse */
export function roForms(one: string, few: string): PluralForms {
  return { one, few, many: few, other: `de ${few}` };
}
