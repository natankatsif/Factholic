import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { FileText, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { INPUT_EXAMPLES, LINK_HINT, type InputExample } from "./examples";
import { PLATFORMS, PlatformIcon, platformOfLink, type PlatformId } from "./SupportedPlatforms";

export interface LinkInputCardProps {
  onCheck: (urlOrText: string, isUrl: boolean) => void;
  isLoading?: boolean;
  onTypingChange?: (isTyping: boolean, text: string) => void;
  /** Платформа из «Попробуй с»: поле становится однострочным для ссылки; null — поле для текста */
  platform: PlatformId | null;
  onPlatformChange: (id: PlatformId | null) => void;
  /** Что вернуть в поле (проверка не нашла утверждений — пользователь правит введённое) */
  prefill?: { input: string; isUrl: boolean } | null;
}

export function LinkInputCard({
  onCheck,
  isLoading = false,
  onTypingChange,
  platform: platformId,
  onPlatformChange,
  prefill,
}: LinkInputCardProps) {
  const platform = PLATFORMS.find((p) => p.id === platformId) ?? null;
  const isLink = platform !== null;
  const [inputValue, setInputValue] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout>();
  /** Высота карточки на прошлом рендере — от неё плавно идём к новой при смене режима */
  const lastHeight = useRef<number | null>(null);
  const wasLink = useRef(isLink);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 220);
    el.style.height = `${Math.max(nextHeight, 46)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [inputValue, isLink]);

  // Вернулись с проверки без утверждений — в поле то, что вводили: ссылка — на своей платформе, иначе текст
  useEffect(() => {
    if (!prefill?.input) return;
    const detected = prefill.isUrl ? platformOfLink(prefill.input) : null;
    if (detected) {
      setLinkValue(prefill.input);
      onPlatformChange(detected.id);
    } else {
      setInputValue(prefill.input);
      onPlatformChange(null);
    }
    onTypingChange?.(false, prefill.input);
  }, [prefill]);

  // Сменили платформу — старая ошибка ссылки уже ни к чему, курсор сразу в поле
  useEffect(() => {
    setLinkError(null);
    if (platformId) linkRef.current?.focus({ preventScroll: true });
  }, [platformId]);

  // Карточка плавно меняет высоту (многострочный текст ↔ одна строка ссылки), содержимое проявляется
  useLayoutEffect(() => {
    const form = formRef.current;
    const from = lastHeight.current;
    if (wasLink.current === isLink) return;
    wasLink.current = isLink;
    if (!isLink) textareaRef.current?.focus({ preventScroll: true });
    if (!form || from === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = form.getBoundingClientRect().height;
    form.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 360,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    contentRef.current?.animate(
      [
        { opacity: 0, filter: "blur(3px)", transform: "translateY(3px)" },
        { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
      ],
      { duration: 280, delay: 60, easing: "ease-out", fill: "backwards" },
    );
  }, [isLink]);

  // запоминаем высоту после каждого рендера (объявлен после анимации — она успевает прочитать прошлую)
  useLayoutEffect(() => {
    lastHeight.current = formRef.current?.getBoundingClientRect().height ?? null;
  });

  // заготовка из подсказки у иконки: подставляем в поле и ставим туда курсор — проверить решает пользователь
  const pickExample = (value: string) => {
    setLinkError(null);
    if (isLink) {
      setLinkValue(value);
      linkRef.current?.focus({ preventScroll: true });
    } else {
      setInputValue(value);
      textareaRef.current?.focus({ preventScroll: true });
    }
    onTypingChange?.(false, value);
  };

  const reportTyping = (val: string) => {
    onTypingChange?.(true, val);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingChange?.(false, val);
    }, 1200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    reportTyping(val);
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLinkValue(val);
    setLinkError(null);
    reportTyping(val);
    // вставили ссылку другой платформы — плашка переключается сама
    const detected = platformOfLink(val);
    if (detected && detected.id !== platformId) onPlatformChange(detected.id);
  };

  // В пустое поле текста вставили ссылку с платформы из «Попробуй с» — сразу переключаемся на ссылку
  const handleTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    const detected = inputValue.trim() ? null : platformOfLink(pasted);
    if (!detected) return;
    e.preventDefault();
    setLinkValue(pasted);
    onPlatformChange(detected.id);
    reportTyping(pasted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // На десктопе Enter отправляет запрос, а Shift+Enter делает перенос строки
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFocus = () => {
    onTypingChange?.(true, isLink ? linkValue : inputValue);
  };

  const handleBlur = () => {
    onTypingChange?.(false, isLink ? linkValue : inputValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (platform) {
      const link = linkValue.trim();
      if (!link) return;
      if (!platform.matches(link)) {
        setLinkError(platform.invalidText ?? `Это не похоже на ссылку ${platform.name}`);
        return;
      }
      onCheck(link, true);
      return;
    }

    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const isUrl =
      /^https?:\/\//i.test(trimmed) ||
      trimmed.includes("youtu.be") ||
      trimmed.includes("tiktok.com") ||
      trimmed.includes("facebook.com") ||
      trimmed.includes("twitter.com") ||
      trimmed.includes("x.com");

    onCheck(trimmed, isUrl);
  };

  const submitButton = (
    <button
      type="submit"
      disabled={isLoading}
      data-pencil-name="Check Button"
      className="box-border w-fit shrink-0 h-[36px] sm:h-[40px] xl:h-[42px] flex flex-row gap-1.5 sm:gap-2 px-4 sm:px-5 xl:px-6 justify-center items-center bg-[#4A3333] hover:bg-[#362424] active:scale-[0.98] rounded-[100px] border-none transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shadow-xs"
    >
      {isLoading ? (
        <span className="flex items-center gap-2 text-white font-extrabold text-xs sm:text-sm xl:text-[16px]">
          <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Проверяем…
        </span>
      ) : (
        <>
          <span
            data-pencil-name="Label"
            className="text-xs sm:text-sm xl:text-[16px] leading-normal box-border text-[#FFFFFF] font-extrabold text-left whitespace-nowrap"
          >
            Проверить
          </span>
          <svg
            data-pencil-name="Arrow"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="box-border w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white"
          >
            <path
              d="M6.90088 2.35156q-0.18115 0.02734-0.32129 0.16748-0.11279 0.11279-0.14697 0.28028-0.03418 0.16748 0.02051 0.32129 0.02734 0.08545 0.25976 0.3247 0.23242 0.23584 1.36377 1.37061 1.58252 1.58252 1.58252 1.59619 0 0.01367-3.45557 0.01367l-3.44531 0-0.08545 0.04102q-0.22217 0.11279-0.30078 0.33838-0.0752 0.22217 0.00684 0.43408 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.16748 0.11963 0.08545 0.03418 0.53321 0.03418l3.01123 0q3.42822 0 3.42822 0.01367 0 0.01367-1.58252 1.59619-1.13135 1.13477-1.36377 1.37402-0.23242 0.23584-0.25976 0.3213-0.05469 0.15381-0.02051 0.32128 0.03418 0.16748 0.14697 0.28028 0.18115 0.18115 0.42041 0.18115l0.04102 0q0.11279 0 0.19824-0.05469 0.14014-0.09912 0.51611-0.46484l1.68164-1.67822q2.1123-2.10205 2.15332-2.18409 0.07178-0.12646 0.07178-0.28027 0-0.15381-0.07178-0.28027-0.04102-0.08203-2.1499-2.18067-2.10547-2.10205-2.17725-2.13623-0.06836-0.0376-0.23584-0.06494-0.04102 0-0.12646 0.01367z"
              fill="#FFFFFF"
            />
          </svg>
        </>
      )}
    </button>
  );

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-2.5 sm:gap-3">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        data-pencil-name="Link Input"
        className={`box-border w-full shrink-0 overflow-hidden [box-shadow:0px_12px_32px_rgba(74,51,51,0.12)] bg-[#FBF8F7] [outline:2px_solid_#E2D7D4] [outline-offset:-1px] transition-[outline-color,border-radius] focus-within:[outline-color:#4A3333] ${
          isLink
            ? "flex flex-row items-center rounded-[30px] p-2 pl-4 sm:p-2.5 sm:pl-5"
            : "flex flex-col justify-between rounded-[22px] p-3 pb-2.5 sm:rounded-[26px] sm:p-4 sm:pb-3"
        } ${linkError ? "[outline-color:#E2353F]" : ""}`}
      >
        {platform ? (
          <div ref={contentRef} className="flex w-full flex-row items-center gap-2.5 sm:gap-3.5">
            <ExamplesTooltip platformId={platformId} onPick={pickExample} className="-ml-1.5">
              <PlatformIcon platform={platform} className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
            </ExamplesTooltip>
            <input
              ref={linkRef}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={linkValue}
              onChange={handleLinkChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={platform.placeholder}
              className="min-w-0 flex-1 border-none bg-transparent text-[15px] font-semibold text-[#4A3333] placeholder-[#A27C7A] outline-none sm:text-[17px] xl:text-[19px]"
            />
            {submitButton}
          </div>
        ) : (
          <div ref={contentRef} className="flex w-full flex-col justify-between">
            {/* Upper row: Document/Text Icon + Auto-growing Textarea */}
            <div className="flex flex-row items-start gap-2.5 sm:gap-3.5 w-full">
              <ExamplesTooltip platformId={null} onPick={pickExample} className="-ml-1.5 -mt-1 sm:-mt-0.5">
                <FileText
                  data-pencil-name="Text Icon"
                  strokeWidth={2.2}
                  className="box-border w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#A27C7A]"
                />
              </ExamplesTooltip>

              <textarea
                ref={textareaRef}
                rows={2}
                value={inputValue}
                onChange={handleInputChange}
                onPaste={handleTextPaste}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="Вставь текст поста или сообщения, которое хочешь проверить…"
                data-pencil-name="Placeholder"
                className="text-[15px] sm:text-[17px] xl:text-[19px] leading-relaxed box-border flex-1 text-[#4A3333] placeholder-[#A27C7A] font-semibold text-left bg-transparent border-none outline-none resize-none min-w-0 min-h-[46px] sm:min-h-[50px] xl:min-h-[54px] max-h-[220px] overflow-y-auto"
              />
            </div>

            {/* Bottom action row: submit button on the right */}
            <div className="flex flex-row justify-end items-center w-full pt-1.5 sm:pt-2">{submitButton}</div>
          </div>
        )}
      </form>

      {linkError && <span className="pl-5 text-xs font-bold text-[#E2353F] sm:text-sm">{linkError}</span>}
    </div>
  );
}

/**
 * Иконка слева в поле — триггер подсказки с заготовками (shadcn Tooltip на Radix). Набор зависит от плашки
 * «Попробуй с»: текст, YouTube, Shorts; для TikTok, Facebook и X — где взять ссылку. Клик по заготовке
 * подставляет её в поле. Наведение — открывает, клик по иконке — тоже (на телефоне наведения нет).
 */
function ExamplesTooltip({
  platformId,
  onPick,
  className = "",
  children,
}: {
  platformId: PlatformId | null;
  onPick: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const examples: InputExample[] = INPUT_EXAMPLES[platformId ?? "text"];
  const hint = platformId ? LINK_HINT[platformId] : undefined;
  const isText = platformId === null;

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            // Radix закрывает подсказку на нажатие и клик по триггеру (после нашего обработчика) — на телефоне,
            // где нет наведения, она бы не открывалась вовсе. preventDefault отменяет его закрытие; закрывается
            // она тапом мимо или Esc
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            aria-label="Примеры для проверки"
            className={`group/tt relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors hover:bg-[#F1EBE9] data-[state=delayed-open]:bg-[#F1EBE9] data-[state=instant-open]:bg-[#F1EBE9] ${className}`}
          >
            {children}
            {examples.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFC20E] text-[#4A3333] shadow-sm transition-transform group-hover/tt:scale-110">
                <Lightbulb className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="w-[min(340px,calc(100vw-2rem))] p-1.5">
          <div className="px-2.5 pb-1.5 pt-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            {examples.length
              ? isText
                ? "Попробуй готовый текст"
                : platformId === "link"
                  ? "Попробуй свежую новость"
                  : "Попробуй готовое видео"
              : "Где взять ссылку"}
          </div>
          {examples.length ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {examples.map((ex) => (
                <li key={ex.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(ex.value);
                      setOpen(false);
                    }}
                    className="flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border-none bg-transparent px-2.5 py-2 text-left text-white transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <span className="text-[13px] font-bold leading-snug">
                      {isText ? `«${ex.label}»` : ex.label}
                    </span>
                    {ex.meta && <span className="text-[11px] font-semibold text-white/55">{ex.meta}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 px-2.5 pb-2 text-[13px] font-semibold leading-snug text-white/85">{hint}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
