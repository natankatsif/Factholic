import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "streamdown/styles.css";
import "./globals.css";

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
const SHARE_TITLE = "factholic — откуда взялось утверждение";
const SHARE_DESCRIPTION =
  "Мы не выносим вердикт: показываем, откуда пришла информация и что с ней случилось по дороге. Каждый факт ведёт к источнику.";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: "factholic - Проверь любое видео",
  description: "Вставь ссылку — откроем плеер и разберём каждое утверждение",
  // Превью ссылки в мессенджерах и соцсетях. Картинка — файлы app/opengraph-image.png и twitter-image.png
  // (с подписями *.alt.txt): Next сам ставит og:image / twitter:image с размерами
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    siteName: "factholic",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  // иконка у ссылки во вкладке и в закладках — жёлтый чудик (public/blob.png)
  icons: {
    icon: [{ url: "/blob.png", type: "image/png", sizes: "28x28" }],
  },
};

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
  return (
    <html lang="ru" className={nunito.variable}>
      <body className="min-h-screen bg-[#F1EBE9] font-sans text-[#4A3333] antialiased selection:bg-[#4A3333] selection:text-white">
        {children}
      </body>
    </html>
  );
}
