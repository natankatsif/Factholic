import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getCabinetDictionary } from "../../components/cabinet/dictionary";

const t = getCabinetDictionary();

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
};

/**
 * Кабинет — приложение на весь экран: страница не должна пружинить, а свайп двумя пальцами не должен листать
 * историю браузера. Стили живут только на страницах кабинета, лендинг они не трогают
 */
const FIXED_PAGE = "html, body { height: 100%; overflow: hidden; overscroll-behavior: none; }";

export default function CabinetLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{FIXED_PAGE}</style>
      {children}
    </>
  );
}
