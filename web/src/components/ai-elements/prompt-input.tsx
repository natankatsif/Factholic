"use client";

import type { ChatStatus } from "ai";
import { ArrowUp, LoaderCircle, Square, X } from "lucide-react";
import React, {
  useCallback,
  useState,
  type ComponentProps,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEventHandler,
} from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export interface PromptInputMessage {
  text: string;
}

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
};

/** Форма ввода: Enter — отправить, Shift+Enter — новая строка. Поле очищается после отправки */
export const PromptInput = ({ className, onSubmit, ...props }: PromptInputProps) => {
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const text = (new FormData(form).get("message") as string | null)?.trim() ?? "";
      if (!text) return;
      onSubmit({ text }, event);
      form.reset();
    },
    [onSubmit],
  );

  return (
    <form
      className={cn(
        "flex w-full items-end gap-2 rounded-[24px] bg-muted py-1.5 pl-5 pr-1.5 transition-shadow focus-within:ring-2 focus-within:ring-ring/15",
        className,
      )}
      onSubmit={handleSubmit}
      {...props}
    />
  );
};

export type PromptInputTextareaProps = ComponentProps<"textarea">;

export const PromptInputTextarea = ({
  onKeyDown,
  className,
  placeholder = "Спросите что-нибудь…",
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      onKeyDown?.(e);
      if (e.defaultPrevented || e.key !== "Enter" || e.shiftKey) return;
      if (isComposing || e.nativeEvent.isComposing) return;
      e.preventDefault();
      const submitButton = e.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitButton?.disabled) return;
      e.currentTarget.form?.requestSubmit();
    },
    [onKeyDown, isComposing],
  );

  return (
    <textarea
      className={cn(
        "max-h-32 min-h-[40px] min-w-0 flex-1 resize-none self-center border-none bg-transparent py-2.5 text-sm font-semibold leading-5 text-foreground outline-none placeholder:text-muted-foreground",
        className,
      )}
      name="message"
      rows={1}
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onInput={(e) => {
        // растёт по содержимому (field-sizing в Tailwind 3 нет)
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn("flex shrink-0 items-center gap-1 self-end", className)} {...props} />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming";

  let Icon = <ArrowUp className="size-[18px]" />;
  if (status === "submitted") Icon = <LoaderCircle className="size-[18px] animate-spin" />;
  else if (status === "streaming") Icon = <Square className="size-4" />;
  else if (status === "error") Icon = <X className="size-[18px]" />;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isGenerating && onStop) {
        e.preventDefault();
        onStop();
        return;
      }
      onClick?.(e);
    },
    [isGenerating, onStop, onClick],
  );

  return (
    <Button
      aria-label={isGenerating ? "Остановить" : "Спросить"}
      title={isGenerating ? "Остановить" : "Спросить"}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};
