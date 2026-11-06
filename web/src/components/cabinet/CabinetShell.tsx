"use client";

/** Каркас кабинета: верхняя панель, левое меню и список проверок в процессе работают на любой странице */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCabinetActions } from "./actions";
import { NarrativeDialog, SuggestionDialog } from "./Dialogs";
import { POPOVER_PANEL, usePopover } from "./Popover";
import { Bone } from "./Skeletons";
import { cn } from "../../lib/utils";
import { useCabinetText } from "./dictionary";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import {
  ArrowRightIcon,
  BellIcon,
  CaretDownIcon,
  ChatIcon,
  EyeIcon,
  PanelIcon,
  PlusIcon,
  QuestionIcon,
  SpinnerIcon,
  TrayIcon,
  UserIcon,
} from "./icons";
import type {
  AlertItem,
  CabinetSession,
  ClarificationView,
  ClaimScope,
  OverlayState,
  RunningCheck,
  SuggestionView,
} from "./types";
import { Link2, Video } from "lucide-react";

interface NarrativeRequest {
  claimIds: string[];
  suggestionId?: string;
  narrativeId?: string;
}

/** Открыть диалог нарратива с любого экрана внутри каркаса */
const NarrativeDialogContext = createContext<(request: NarrativeRequest) => void>(() => undefined);

export const useOpenNarrativeDialog = () => useContext(NarrativeDialogContext);

function AlertsMenu({ alerts, unread }: { alerts: AlertItem[]; unread: number }) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const router = useRouter();
  const { open, setOpen, ref } = usePopover();
  const openAlert = (alert: AlertItem) => {
    setOpen(false);
    void actions.readAlert(alert.id);
    router.push(actions.alertHref(alert.checkId, alert.claimId));
  };
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t.topBar.notifications}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-card"
      >
        <BellIcon className="h-5 w-5" />
      </button>
      {unread > 0 && (
        <span className="pointer-events-none absolute -top-[3px] left-6 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[12px] font-black text-white">
          {unread}
        </span>
      )}
      {open && (
        <div
          className={cn(
            POPOVER_PANEL,
            "right-0 top-[50px] flex max-h-[520px] w-[360px] flex-col gap-1 overflow-y-auto overscroll-none",
          )}
        >
          <div className="px-3 py-2 text-[16px] font-black">{t.alerts.menuTitle}</div>
          {alerts.length === 0 && (
            <div className="px-3 pb-3 text-[14px] font-bold leading-[19px] text-cabinet-ink-mid">
              {t.alerts.empty}
            </div>
          )}
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => openAlert(alert)}
              className={cn(
                "flex flex-col gap-0.5 rounded-[14px] px-3 py-2 text-left",
                alert.unread && "bg-cabinet-new-soft",
              )}
            >
              <span className="flex w-full justify-between gap-2">
                <span className="text-[14px] font-black">{alert.title}</span>
                <span className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
                  {alert.time}
                </span>
              </span>
              <span className="text-[13px] font-bold leading-[17px]">{alert.text}</span>
              <span className="truncate text-[12px] font-bold text-cabinet-ink-mid">{alert.claim}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SCOPE_ICONS: Record<ClaimScope, typeof ChatIcon> = {
  all: ChatIcon,
  mine: UserIcon,
  watched: EyeIcon,
  running: SpinnerIcon,
  ungrouped: TrayIcon,
};
const SCOPE_HREF: Record<ClaimScope, string> = {
  all: "/cabinet/questions",
  mine: "/cabinet/questions?scope=mine",
  watched: "/cabinet/watches",
  running: "/cabinet/questions?scope=running",
  ungrouped: "/cabinet/questions?scope=ungrouped",
};
/** Пауза, чтобы успеть перевести мышь с кнопки на выехавшее меню */
const HOVER_CLOSE_MS = 250;
const SCOPES: ClaimScope[] = ["all", "mine", "watched", "running"];

function RunningSteps({ check }: { check: RunningCheck }) {
  return (
    <div className="flex w-full gap-[3px]">
      {Array.from({ length: check.totalSteps }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 flex-1 rounded-[3px]",
            index + 1 < check.step && "bg-primary",
            index + 1 === check.step && "bg-cabinet-blue",
            index + 1 > check.step && "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function RunningList({ checks }: { checks: RunningCheck[] }) {
  const t = useCabinetText();
  return (
    <div className="absolute left-0 top-[50px] z-40 flex w-[400px] flex-col gap-3.5 rounded-3xl bg-card p-[18px] shadow-[0_10px_30px_#4A333333] outline outline-2 -outline-offset-1 outline-border">
      <div className="w-full text-[16px] font-black">
        {t.running.title(checks.length, t.plural(checks.length, t.running.checks))}
      </div>
      {checks.map((check) => (
        <div key={check.id} className="flex w-full flex-col items-start gap-1.5">
          <div className="w-full text-[14px] font-black leading-[18px]">«{check.claim}»</div>
          <RunningSteps check={check} />
          <div className="flex w-full items-center justify-between">
            <span className="min-w-0 text-[12px] font-bold text-cabinet-ink-mid">
              {t.running.step(check.step, check.totalSteps, check.message)}
            </span>
            <span className="whitespace-nowrap text-[12px] font-extrabold">
              {t.running.found(check.found)}
            </span>
          </div>
          <Link
            href={
              check.video
                ? `/cabinet/videos/${check.id}`
                : check.article
                  ? `/cabinet/links/${check.id}`
                  : `/cabinet/checks/${check.id}`
            }
            className="flex items-center gap-1 text-[13px] font-extrabold"
          >
            {t.running.openCanvas}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      ))}
      <div className="flex w-full items-center gap-2 rounded-[14px] bg-canvas px-3 py-2.5">
        <BellIcon className="h-4 w-4 shrink-0 text-cabinet-ink-mid" />
        <div className="flex-1 text-[12px] font-bold leading-4 text-cabinet-ink-mid">{t.running.hint}</div>
      </div>
    </div>
  );
}

/** Вопрос модели перед проверкой: ждёт ответа в верхней панели, на любой странице */
function ClarificationBlock({ items }: { items: ClarificationView[] }) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const { open, setOpen, ref } = usePopover();
  const [other, setOther] = useState("");
  const first = items[0];
  const firstId = first?.id;
  // новый вопрос раскрывается сам: без ответа проверка не начнётся
  useEffect(() => {
    if (firstId) setOpen(true);
    setOther("");
  }, [firstId, setOpen]);
  if (!first) return null;
  const button = "whitespace-nowrap rounded-full px-4 py-[9px] text-[14px] font-extrabold";
  const answer = (value: "yes" | "no" | "other") => {
    setOpen(false);
    void actions.answerClarification(first.id, value, value === "other" ? other : undefined);
  };
  const choose = (index: number) => {
    setOpen(false);
    void actions.chooseClaim(first.id, index);
  };
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-2 rounded-full bg-cabinet-split-soft px-3.5 text-[14px] font-extrabold"
      >
        <QuestionIcon className="h-[18px] w-[18px]" />
        <span className="whitespace-nowrap">{t.clarify.title}</span>
        {items.length > 1 && (
          <span className="text-[12px] font-black">{t.clarify.more(items.length - 1)}</span>
        )}
      </button>
      {open && (
        <div className={cn(POPOVER_PANEL, "left-0 top-[50px] flex w-[420px] flex-col gap-2.5 p-[18px]")}>
          {first.options ? (
            <>
              <div className="text-[16px] font-black leading-5">{t.clarify.pickTitle}</div>
              {first.options.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => choose(index)}
                  className="w-full rounded-[14px] px-3 py-2.5 text-left text-[14px] font-extrabold leading-[18px] outline outline-2 -outline-offset-1 outline-border hover:outline-primary"
                >
                  {option}
                </button>
              ))}
              <button
                type="button"
                onClick={() => answer("no")}
                className={cn(button, "self-start outline outline-2 -outline-offset-1 outline-primary")}
              >
                {t.clarify.pickAll}
              </button>
            </>
          ) : (
            <>
              <div className="text-[16px] font-black leading-5">{first.question}</div>
              <div className="flex flex-col gap-1 rounded-[14px] bg-canvas p-3">
                <div className="text-[12px] font-extrabold text-cabinet-ink-mid">{t.clarify.original}</div>
                <div className="text-[14px] font-bold leading-[18px]">{first.input}</div>
              </div>
              <div className="flex flex-col gap-1 rounded-[14px] bg-cabinet-split-soft p-3">
                <div className="text-[12px] font-extrabold text-cabinet-ink-mid">{t.clarify.rewritten}</div>
                <div className="text-[14px] font-extrabold leading-[18px]">{first.rewritten}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => answer("yes")}
                  className={cn(button, "bg-primary text-white")}
                >
                  {t.clarify.yes}
                </button>
                <button
                  type="button"
                  onClick={() => answer("no")}
                  className={cn(button, "outline outline-2 -outline-offset-1 outline-primary")}
                >
                  {t.clarify.no}
                </button>
              </div>
            </>
          )}
          <div className="text-[13px] font-extrabold">{t.clarify.other}</div>
          <div className="flex items-center gap-2">
            <input
              value={other}
              onChange={(event) => setOther(event.target.value)}
              placeholder={t.clarify.otherPlaceholder}
              aria-label={t.clarify.other}
              className="min-w-0 flex-1 rounded-full bg-canvas px-3.5 py-2 text-[14px] font-bold outline-none placeholder:text-cabinet-ink-mid"
            />
            <button
              type="button"
              disabled={!other.trim()}
              onClick={() => answer("other")}
              className={cn(button, "bg-primary text-white disabled:bg-border disabled:text-cabinet-ink-mid")}
            >
              {t.clarify.send}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RunningBlock({ checks, initialOpen }: { checks: RunningCheck[]; initialOpen?: boolean }) {
  const t = useCabinetText();
  const [open, setOpen] = useState(Boolean(initialOpen));
  const first = checks[0];
  if (!first) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t.topBar.runningChecks}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-full bg-card px-3 outline outline-2 -outline-offset-1 outline-border"
      >
        <SpinnerIcon className="h-[18px] w-[18px] animate-spin text-cabinet-blue" />
        <span className="w-[221px] truncate text-left text-[14px] font-extrabold">{first.claim}</span>
        <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">
          {t.topBar.step(first.step, first.totalSteps)}
        </span>
        {checks.length > 1 && (
          <span className="rounded-full bg-cabinet-blue/10 px-[7px] py-0.5 text-[12px] font-black text-cabinet-blue">
            {t.topBar.more(checks.length - 1)}
          </span>
        )}
        <CaretDownIcon className="h-[15px] w-[15px] text-cabinet-ink-mid" />
      </button>
      {open && <RunningList checks={checks} />}
    </div>
  );
}

function TopBar({
  session,
  loading,
  menuOpen,
  onToggleMenu,
  onMenuHover,
  onMenuHoverEnd,
  checksDisabled,
  runningOpen,
}: {
  session?: CabinetSession;
  loading?: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onMenuHover?: () => void;
  onMenuHoverEnd?: () => void;
  checksDisabled: boolean;
  runningOpen?: boolean;
}) {
  const t = useCabinetText();
  return (
    <header className="relative z-30 -mb-px flex h-[73px] w-full shrink-0 items-center justify-between border-b-2 border-border bg-canvas px-6">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleMenu}
          onMouseEnter={onMenuHover}
          onMouseLeave={onMenuHoverEnd}
          aria-label={menuOpen ? t.topBar.closeMenu : t.topBar.openMenu}
          aria-expanded={menuOpen}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full outline outline-2 -outline-offset-1",
            menuOpen ? "bg-primary text-white outline-primary" : "bg-card outline-border",
          )}
        >
          <PanelIcon className="h-5 w-5" />
        </button>
        <Link
          href="/cabinet/questions"
          title={t.brand.homeTitle}
          className="whitespace-nowrap text-[26px] font-black"
        >
          {t.brand.name}
        </Link>
        <span className="rounded-full bg-primary px-2.5 py-1 text-[12px] font-extrabold text-white">
          {t.brand.badge}
        </span>
      </div>
      {session && (
        <div className="flex items-center gap-2">
          <ClarificationBlock items={session.clarifications} />
          <RunningBlock checks={session.running} initialOpen={runningOpen} />
        </div>
      )}
      <div className="flex items-center justify-end gap-3.5">
        <Link
          href="/cabinet"
          aria-disabled={checksDisabled}
          className={cn(
            "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[14px] font-extrabold",
            checksDisabled ? "pointer-events-none bg-border text-cabinet-ink-mid" : "bg-primary text-white",
          )}
        >
          <PlusIcon className="h-4 w-4" />
          {t.topBar.newCheck}
        </Link>
        <LanguageSwitcher label={t.topBar.language} />
        <AlertsMenu alerts={session?.alerts ?? []} unread={session?.unreadAlerts ?? 0} />
        {loading && (
          <>
            <div className="flex flex-col items-end gap-1.5">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-3 w-24" />
            </div>
            <Bone className="h-[38px] w-[38px] rounded-full" />
          </>
        )}
        {session && (
          <>
            <div className="flex flex-col items-end">
              <div className="whitespace-nowrap text-[14px] font-black">{session.organization}</div>
              <div className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
                {t.topBar.member(session.memberName, session.memberRole)}
              </div>
            </div>
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-cabinet-split text-[16px] font-black">
              {session.memberInitial}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function LeftMenu({
  session,
  scope,
  videos,
  links,
  narrativeId,
  newCheckActive,
  className,
  onShowSuggestion,
}: {
  session?: CabinetSession;
  scope?: ClaimScope;
  videos?: boolean;
  links?: boolean;
  narrativeId?: string;
  newCheckActive?: boolean;
  className?: string;
  onShowSuggestion: (suggestion: SuggestionView) => void;
}) {
  const t = useCabinetText();
  const openNarrative = useOpenNarrativeDialog();
  const suggestion = session?.suggestions[0];
  const row = "flex w-full items-center gap-[9px] rounded-[14px] px-3 py-[9px]";
  return (
    <nav className={cn("flex w-[281px] shrink-0 flex-col items-start gap-1 bg-card px-4 py-6", className)}>
      <Link href="/cabinet" className={cn(row, newCheckActive && "bg-primary")}>
        <PlusIcon
          className={cn("h-[17px] w-[17px] shrink-0", newCheckActive ? "text-white" : "text-cabinet-ink-mid")}
        />
        <span className={cn("flex-1 text-[14px] font-extrabold", newCheckActive && "text-white")}>
          {t.topBar.newCheck}
        </span>
      </Link>
      {SCOPES.map((item) => {
        const Icon = SCOPE_ICONS[item];
        const active = item === scope;
        const running = item === "running";
        return (
          <Link key={item} href={SCOPE_HREF[item]} className={cn(row, active && "bg-primary")}>
            <Icon
              className={cn(
                "h-[17px] w-[17px] shrink-0",
                active ? "text-white" : running ? "text-cabinet-blue" : "text-cabinet-ink-mid",
              )}
            />
            <span className={cn("flex-1 text-[14px] font-extrabold", active && "text-white")}>
              {t.menu[item]}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-[13px] font-extrabold",
                active ? "text-white" : running ? "text-cabinet-blue" : "text-cabinet-ink-mid",
              )}
            >
              {session?.counts[item]}
            </span>
          </Link>
        );
      })}
      <Link href="/cabinet/videos" className={cn(row, videos && "bg-primary")}>
        <Video
          className={cn("h-[17px] w-[17px] shrink-0", videos ? "text-white" : "text-cabinet-ink-mid")}
          strokeWidth={2.4}
        />
        <span className={cn("flex-1 text-[14px] font-extrabold", videos && "text-white")}>
          {t.menu.videos}
        </span>
        <span
          className={cn(
            "whitespace-nowrap text-[13px] font-extrabold",
            videos ? "text-white" : "text-cabinet-ink-mid",
          )}
        >
          {session?.counts.videos}
        </span>
      </Link>
      <Link href="/cabinet/links" className={cn(row, links && "bg-primary")}>
        <Link2
          className={cn("h-[17px] w-[17px] shrink-0", links ? "text-white" : "text-cabinet-ink-mid")}
          strokeWidth={2.4}
        />
        <span className={cn("flex-1 text-[14px] font-extrabold", links && "text-white")}>{t.menu.links}</span>
        <span
          className={cn(
            "whitespace-nowrap text-[13px] font-extrabold",
            links ? "text-white" : "text-cabinet-ink-mid",
          )}
        >
          {session?.counts.links}
        </span>
      </Link>
      <div className="flex w-full items-center justify-between px-3 pb-1.5 pt-5">
        <span className="whitespace-nowrap text-[15px] font-black">{t.menu.narratives}</span>
        <button
          type="button"
          aria-label={t.menu.addNarrative}
          onClick={() => openNarrative({ claimIds: [] })}
        >
          <PlusIcon className="h-[17px] w-[17px]" />
        </button>
      </div>
      {session?.narratives.map((narrative) => {
        const active = narrative.id === narrativeId;
        return (
          <Link
            key={narrative.id}
            href={`/cabinet/narratives/${narrative.id}`}
            className={cn(row, active && "bg-primary")}
          >
            <span className={cn("flex-1 text-[14px] font-extrabold", active && "text-white")}>
              {narrative.title}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-[13px] font-extrabold",
                active ? "text-white" : "text-cabinet-ink-mid",
              )}
            >
              {narrative.count}
            </span>
          </Link>
        );
      })}
      <div className="w-full flex-1" />
      {suggestion && (
        <div className="flex w-full flex-col items-start gap-2 rounded-[20px] bg-canvas p-3.5">
          <div className="w-full text-[14px] font-black">{t.menu.suggestionTitle}</div>
          <div className="w-full text-[13px] font-bold leading-[17px]">
            {t.suggestion.text(
              suggestion.claims.length,
              t.plural(suggestion.claims.length, t.suggestion.questions),
              suggestion.topic,
            )}
          </div>
          <button
            type="button"
            onClick={() => onShowSuggestion(suggestion)}
            className="whitespace-nowrap text-[13px] font-extrabold"
          >
            {t.menu.suggestionAction}
          </button>
        </div>
      )}
    </nav>
  );
}

export interface CabinetShellProps {
  session?: CabinetSession;
  /** Страницы списков: кнопка меню без тёмного состояния, как на макете */
  pinnedMenu?: boolean;
  scope?: ClaimScope;
  narrativeId?: string;
  /** Страница новой проверки: подсвечен свой пункт, меню закрыто и выезжает при наведении */
  newCheck?: boolean;
  /** Открыт раздел видео: подсветить его в меню */
  videos?: boolean;
  /** Открыт раздел ссылок */
  links?: boolean;
  /** Страница дерева: меню закрыто и выезжает при наведении, дереву нужно место */
  tree?: boolean;
  /** Данные грузятся: вместо имени организации скелетон */
  loading?: boolean;
  overlay?: OverlayState;
  checksDisabled?: boolean;
  children: ReactNode;
}

export function CabinetShell({
  session,
  pinnedMenu,
  scope,
  videos,
  links,
  narrativeId,
  newCheck,
  tree,
  loading,
  overlay,
  checksDisabled = false,
  children,
}: CabinetShellProps) {
  // Списки: при каждом приходе меню открыто. Дерево и новая проверка: при каждом приходе закрыто.
  // Кнопка меняет это только на текущей странице, ничего не запоминается
  const focusPage = Boolean(newCheck || tree);
  const [menuOpen, setMenuOpen] = useState(overlay?.menuOpen ?? !focusPage);
  const [suggestion, setSuggestion] = useState<SuggestionView>();
  const [narrativeRequest, setNarrativeRequest] = useState<NarrativeRequest>();
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout>>();
  const canPeek = focusPage && !menuOpen;
  const showPeek = () => {
    clearTimeout(peekTimer.current);
    if (canPeek) setPeek(true);
  };
  const hidePeek = () => {
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(false), HOVER_CLOSE_MS);
  };
  const toggleMenu = () => {
    setPeek(false);
    setMenuOpen(!menuOpen);
  };

  return (
    <NarrativeDialogContext.Provider value={setNarrativeRequest}>
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-canvas [line-height:normal]">
        <TopBar
          session={session}
          menuOpen={!pinnedMenu && menuOpen}
          loading={loading}
          onToggleMenu={toggleMenu}
          onMenuHover={showPeek}
          onMenuHoverEnd={hidePeek}
          checksDisabled={checksDisabled}
          runningOpen={overlay?.runningOpen}
        />
        <div className="relative flex min-h-0 w-full flex-1">
          {menuOpen && (
            <LeftMenu
              session={session}
              scope={scope}
              videos={videos}
              links={links}
              narrativeId={narrativeId}
              newCheckActive={newCheck}
              onShowSuggestion={setSuggestion}
              className="-mr-px h-full border-r-2 border-border"
            />
          )}
          {children}
          {canPeek && (
            <div
              aria-hidden="true"
              onMouseEnter={showPeek}
              onMouseLeave={hidePeek}
              className="absolute bottom-0 left-0 top-0 z-20 w-3"
            />
          )}
          {canPeek && peek && (
            <div
              onMouseEnter={showPeek}
              onMouseLeave={hidePeek}
              className="absolute bottom-0 left-0 top-0 z-30 flex"
            >
              <LeftMenu
                session={session}
                scope={scope}
                videos={videos}
                links={links}
                newCheckActive={newCheck}
                onShowSuggestion={setSuggestion}
                className="border-r-2 border-border"
              />
            </div>
          )}
        </div>
        {suggestion && (
          <SuggestionDialog
            suggestion={suggestion}
            onClose={() => setSuggestion(undefined)}
            onCollect={() => {
              setNarrativeRequest({
                claimIds: suggestion.claims.map((claim) => claim.id),
                suggestionId: suggestion.id,
              });
              setSuggestion(undefined);
            }}
          />
        )}
        {narrativeRequest && (
          <NarrativeDialog
            initialClaimIds={narrativeRequest.claimIds}
            suggestionId={narrativeRequest.suggestionId}
            narrativeId={narrativeRequest.narrativeId}
            onClose={() => setNarrativeRequest(undefined)}
          />
        )}
      </div>
    </NarrativeDialogContext.Provider>
  );
}
