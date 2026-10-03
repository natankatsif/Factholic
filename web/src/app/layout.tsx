import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "streamdown/styles.css";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "factholic — Проверь любое видео",
  description: "Вставь ссылку — откроем плеер и разберём каждое утверждение",
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
