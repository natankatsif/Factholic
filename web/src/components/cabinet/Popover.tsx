"use client";

/** Выпадающий список: закрывается кликом мимо и клавишей Esc */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export const POPOVER_PANEL =
  "absolute z-40 rounded-[20px] bg-card p-1.5 shadow-[0_10px_30px_#4A333333] outline outline-2 -outline-offset-1 outline-border";

export function PopoverItem({
  active,
  danger,
  onClick,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full whitespace-nowrap rounded-[14px] px-3 py-2 text-left text-[14px] font-extrabold hover:bg-canvas ${
        active ? "bg-canvas" : ""
      } ${danger ? "text-cabinet-against-text" : ""}`}
    >
      {children}
    </button>
  );
}
