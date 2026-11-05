"use client";

/** Стартовый экран: поле проверки по центру холста. Состояния 01, 10, 12 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, FormEvent, KeyboardEvent, SVGProps } from "react";
import Link from "next/link";
import { useCabinetActions } from "./actions";
import { cn } from "../../lib/utils";
import { CabinetShell } from "./CabinetShell";
import { CanvasFooter, CanvasToolbar, gridStyle } from "./CanvasChrome";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import { ArrowRightIcon, ChatDotsIcon, EyeIcon, HourglassIcon, SpinnerIcon, TreeIcon } from "./icons";
import { EmptyPanel } from "./RightPanel";
import type { HomeView } from "./types";

const MAX_FIELD_HEIGHT = 240;
const EMPTY_HOME: HomeView = { state: "empty", suggestions: [], recent: [] };

interface HomeCopy {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconTone: string;
  title: string;
  text: string;
  top: string;
}

function useHomeCopy(fixture: Pick<CabinetFixture, "session"> | undefined, home: HomeView): HomeCopy {
  const t = useCabinetText().home;
  const limits = fixture?.session.limits;
  if (home.state === "limit" && limits) {
    return {
      icon: HourglassIcon,
      iconTone: "bg-destructive",
      title: t.limitTitle,
      text: t.limitText(limits.month, limits.checksUsed, limits.checksTotal, limits.resetDate),
      top: "top-[240px]",
    };
  }
  if (home.state === "no-claims") {
    return {
      icon: ChatDotsIcon,
      iconTone: "bg-cabinet-ink-mid",
      title: t.noClaimsTitle,
      text: t.noClaimsText,
      top: "top-[214px]",
    };
  }
  return { icon: TreeIcon, iconTone: "bg-primary", title: t.title, text: t.text, top: "top-[214px]" };
}

export function HomeScreen({ fixture }: { fixture?: Pick<CabinetFixture, "session" | "home" | "overlay"> }) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const home = fixture?.home ?? EMPTY_HOME;
  const copy = useHomeCopy(fixture, home);
  const [input, setInput] = useState(home.input ?? "");
  // пока модель смотрит на текст, повторная отправка запустила бы вторую платную проверку
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const limit = home.state === "limit";
  const limits = fixture?.session.limits;
  // без API проверку запустить нельзя: на рабочем сайте поле отключено
  const disabled = limit || !fixture;
  const Icon = copy.icon;

  // поле растёт вместе с текстом, дальше появляется прокрутка
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_FIELD_HEIGHT)}px`;
    element.style.overflowY = element.scrollHeight > MAX_FIELD_HEIGHT ? "auto" : "hidden";
  }, [input]);

  const start = async (text: string) => {
    if (disabled || pending || !text) return;
    setPending(true);
    try {
      await actions.startCheck(text);
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent | KeyboardEvent) => {
    event.preventDefault();
    void start(input.trim());
  };

  const placeholder = !fixture
    ? t.demo.unavailable
    : limit && limits
      ? t.home.limitPlaceholder(limits.resetDate)
      : t.home.placeholder;

  return (
    <CabinetShell session={fixture?.session} overlay={fixture?.overlay} checksDisabled={limit} newCheck>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden" style={gridStyle()}>
        <CanvasToolbar />
        <CanvasFooter zoom={1} />
        <div
          className={cn(
            "absolute left-1/2 z-[5] flex w-[640px] -translate-x-1/2 flex-col items-center gap-3.5",
            copy.top,
          )}
        >
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full text-white",
              copy.iconTone,
            )}
          >
            <Icon className="h-[30px] w-[30px]" />
          </div>
          <h1 className="w-full text-center text-[34px] font-black [line-height:normal]">{copy.title}</h1>
          <p className="w-full text-center text-[16px] font-bold leading-[22px] text-cabinet-ink-mid">
            {copy.text}
          </p>
          <form
            onSubmit={submit}
            className={cn(
              "flex min-h-[60px] w-full items-end gap-2.5 rounded-[30px] bg-card pl-[22px] pr-2 outline outline-2 -outline-offset-1",
              disabled ? "outline-border" : "outline-primary",
            )}
          >
            <textarea
              ref={field}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                // Enter запускает проверку, Shift+Enter переносит строку
                if (event.key === "Enter" && !event.shiftKey) submit(event);
              }}
              disabled={disabled}
              readOnly={pending}
              placeholder={placeholder}
              aria-label={t.home.placeholder}
              className="min-w-0 flex-1 resize-none bg-transparent py-[19px] text-[16px] font-bold leading-[22px] outline-none placeholder:text-cabinet-ink-mid"
            />
            <button
              type="submit"
              disabled={disabled || pending}
              aria-busy={pending}
              className={cn(
                "mb-2 flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-[22px] text-[15px] font-extrabold",
                disabled || pending ? "bg-border text-cabinet-ink-mid" : "bg-primary text-white",
              )}
            >
              {pending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {pending ? t.home.submitting : t.home.submit}
            </button>
          </form>
          {limit ? (
            <Link
              href="/cabinet/watches"
              className="mt-2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 py-[9px] text-[14px] font-extrabold text-white"
            >
              <EyeIcon className="h-[15px] w-[15px]" />
              {t.home.openWatches}
            </Link>
          ) : (
            home.suggestions.length > 0 && (
              <div className="flex w-full flex-col gap-2 pt-2.5">
                <div className="w-full text-center text-[13px] font-extrabold text-cabinet-ink-mid">
                  {home.state === "no-claims" ? t.home.noClaimsSuggestions : t.home.suggestions}
                </div>
                {home.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() => void start(suggestion)}
                    className="flex w-full items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-left outline outline-2 -outline-offset-1 outline-border"
                  >
                    <span className="flex-1 text-[14px] font-extrabold">{suggestion}</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      <EmptyPanel home={home} limits={limits} />
    </CabinetShell>
  );
}
