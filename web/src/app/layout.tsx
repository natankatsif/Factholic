import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "factholic — Проверка утверждений и дерево первоисточника",
  description: "Анализ новостей, фактов и видео. Дерево происхождения информации, искажения и фактчек.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[#F1EBE9] text-stone-900 antialiased selection:bg-purple-200">
        {children}
      </body>
    </html>
  );
}
