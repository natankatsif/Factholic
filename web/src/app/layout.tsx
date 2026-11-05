import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "streamdown/styles.css";
import "./globals.css";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { OG_LOCALES } from "../i18n/locale";
import { requestLocale } from "../i18n/server";
import { getSiteDictionary } from "../i18n/site";

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
});

/**
 * Адрес сайта: из него Next собирает полные ссылки для превью ссылки (og:image и т. п.) — мессенджеры
 * относительные не понимают. WEB_SITE_URL — в корневом .env; не задан — Next берёт VERCEL_URL или localhost.
 */
const SITE_URL = process.env.WEB_SITE_URL;

/** Заголовки и превью ссылки — на языке посетителя */
export function generateMetadata(): Metadata {
  const locale = requestLocale();
  const { title, description, shareTitle, shareDescription } = getSiteDictionary(locale).meta;
  return {
    ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
    title,
    description,
    // Превью ссылки в мессенджерах и соцсетях. Картинка — файлы app/opengraph-image.png и twitter-image.png
    // (с подписями *.alt.txt): Next сам ставит og:image / twitter:image с размерами
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      siteName: "factholic",
      locale: OG_LOCALES[locale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
    },
    // иконка у ссылки во вкладке и в закладках — жёлтый чудик (public/blob.png)
    icons: {
      icon: [{ url: "/blob.png", type: "image/png", sizes: "28x28" }],
    },
  };
}

// Цвет панели браузера на телефоне и в PWA — как фон страницы, чтобы шапка сливалась с сайтом.
// В Next 14 themeColor задаётся через viewport, в metadata он устарел
export const viewport: Viewport = {
  themeColor: "#F1EBE9",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = requestLocale();
  return (
    <html lang={locale} className={nunito.variable}>
      <body className="min-h-screen bg-[#F1EBE9] font-sans text-[#4A3333] antialiased selection:bg-[#4A3333] selection:text-white">
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
