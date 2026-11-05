import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, localeFromHeader, parseLocale, type Locale } from "./locale";

/** Язык запроса: сохранённый выбор, потом язык браузера, потом язык по умолчанию */
export function requestLocale(): Locale {
  return (
    parseLocale(cookies().get(LOCALE_COOKIE)?.value) ??
    localeFromHeader(headers().get("accept-language")) ??
    DEFAULT_LOCALE
  );
}
