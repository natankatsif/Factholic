import React, { type ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Минимальная кнопка в духе shadcn/ui: компоненты AI Elements ждут Button с variant и size.
 * Полный shadcn не ставим — у сайта свой дизайн, нужны только эти варианты.
 */
const VARIANTS = {
  default: "bg-primary text-primary-foreground hover:bg-[#362424]",
  outline: "border border-solid border-border bg-background text-[#755D5C] hover:bg-white hover:text-foreground",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-border",
} as const;

const SIZES = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
  icon: "h-10 w-10",
  "icon-sm": "h-8 w-8",
} as const;

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 border-solid font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
