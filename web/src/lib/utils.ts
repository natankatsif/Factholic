import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Склейка классов tailwind (как в shadcn) — на ней написаны components/ui и components/ai-elements */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
