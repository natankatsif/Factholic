"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatTimecode, type FactCheck, type JobId } from "@news/contracts";
import { ArrowRight, ArrowUp, ChevronDown, ChevronLeft, RadioTower } from "lucide-react";
import { chatFor } from "../../lib/chat";
import { SourcesCard } from "./AnalysisCard";
import { AssistantChat } from "./AssistantChat";
import { FlagList, StatusPill, summaryLine, uniqueFlags } from "./claim-status";
import { cleanQuote } from "./ClaimTextPanel";
import { plural } from "./filters";
import { hasProvenanceTree } from "./material";

export interface VideoClaimFeedProps {
  jobId: JobId;
  /** Утверждения по порядку таймкодов */
  factChecks: FactCheck[];
  /** Текущее время плеера, с */
  currentTime: number;
  totalSources: number;
  suggestedQuestions?: string[];
  /** Анализ ещё идёт: до какой секунды видео разобрано. undefined — готово */
  analyzedUntil?: number;
  durationSec?: number;
  /** Перемотать видео на секунду и запустить */
  onSeek: (sec: number) => void;
  onOpenTree: (claimId: string) => void;
  /** Вызывается при смене активного утверждения в ленте (по клику или по видео) */
  onActiveClaimChange?: (claimId: string) => void;
}

/** Отступ сверху, на который встаёт текущее утверждение при синхроне с видео */
const TOP_GAP = 4;
/** Запас на неточность времени плеера: утверждение «наступило» чуть раньше его первой секунды */
const TIME_SLACK = 0.3;

/**
 * Правая колонка разбора видео — компактный список всех утверждений по таймкодам.
 * Строка: таймкод (перематывает видео), плашка позиции источников, утверждение, пояснение в одну строку.
 * Раскрыто одно — то, что сейчас в видео, или то, по которому кликнули: флаги, источники, ссылка на дерево.
 * В синхроне с видео текущее утверждение встаёт к верху списка; пользователь листает сам — синхрон выключается.
 * Внизу — вопрос ассистенту: открывает чат по раскрытому утверждению (остальные модель тоже видит).
 */
export function VideoClaimFeed({
  jobId,
  factChecks,
  currentTime,
  totalSources,
  suggestedQuestions,
  analyzedUntil,
  durationSec,
  onSeek,
  onOpenTree,
  onActiveClaimChange,
}: VideoClaimFeedProps) {
  const [synced, setSynced] = useState(true);
  /** Раскрытое кликом; null — раскрыто текущее в видео, "" — свёрнуто всё */
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  /** Чат открыт по этому утверждению */
  const [chatClaimId, setChatClaimId] = useState<string | null>(null);

  const currentId = [...factChecks].reverse().find((fc) => fc.range.start <= currentTime + TIME_SLACK)?.id;
  const openId = pinnedId ?? currentId;

  useEffect(() => {
    onActiveClaimChange?.(openId ?? "");
  }, [openId, onActiveClaimChange]);

  // видео дошло до следующего утверждения — раскрывается оно, закреплённое кликом сворачивается
  const lastCurrent = useRef(currentId);
  useEffect(() => {
    if (lastCurrent.current !== currentId) {
      lastCurrent.current = currentId;
      setPinnedId(null);
    }
  }, [currentId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const alignedId = useRef<string | undefined>(undefined);
  const syncedRef = useRef(synced);
  syncedRef.current = synced;
  const chatOpenRef = useRef(Boolean(chatClaimId));
  chatOpenRef.current = Boolean(chatClaimId);
  const smoothUntil = useRef(0);

  /**
   * Текущее утверждение — вплотную под шапкой «Разбор», прошедшие уходят вверх под неё.
   * Снизу — пустое место, чтобы и последнее утверждение могло встать наверх.
   */
  const align = (behavior: ScrollBehavior) => {
    const box = scrollRef.current;
    const spacer = spacerRef.current;
    if (!box || !spacer) return;
    const el = currentId ? itemRefs.current.get(currentId) : undefined;
    const below = el ? spacer.offsetTop - el.offsetTop : 0;
    spacer.style.height = `${Math.max(0, box.clientHeight - below - TOP_GAP)}px`;
    box.scrollTo({ top: el ? Math.max(0, el.offsetTop - TOP_GAP) : 0, behavior });
    if (behavior === "smooth") smoothUntil.current = Date.now() + 450;
    alignedId.current = currentId;
  };
  const alignRef = useRef(align);
  alignRef.current = align;

  // смена утверждения в синхроне — плавно, как сообщение в чате; первое появление — сразу
  useLayoutEffect(() => {
    if (!synced || chatClaimId) return;
    const smooth = alignedId.current !== undefined && alignedId.current !== currentId;
    align(smooth ? "smooth" : "auto");
  }, [synced, currentId, chatClaimId, factChecks.length]);

  // строки над текущим меняют высоту (раскрытое сворачивается, приходят результаты) — снова ставим наверх
  useEffect(() => {
    const box = scrollRef.current;
    const list = listRef.current;
    if (!box || !list) return;
    const ro = new ResizeObserver(() => {
      if (!syncedRef.current || chatOpenRef.current || Date.now() < smoothUntil.current) return;
      alignRef.current("auto");
    });
    ro.observe(box);
    ro.observe(list);
    return () => ro.disconnect();
  }, [chatClaimId]);

  // Пользователь сам листает список — синхрон выключается (программная прокрутка эти события не шлёт)
  const releaseSync = () => synced && setSynced(false);

  const seekTo = (fc: FactCheck) => {
    onSeek(fc.range.start);
    setPinnedId(null);
    setSynced(true);
  };

  const ask = (question: string) => {
    const claimId = openId || currentId || factChecks[0]?.id;
    if (!claimId || !question.trim()) return;
    void chatFor(jobId, claimId).sendMessage({ text: question.trim() });
    setChatClaimId(claimId);
  };

  const chatClaim = factChecks.find((fc) => fc.id === chatClaimId);

  return (
    <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-[28px] bg-[#FBF8F7] lg:min-h-0">
      <div className="shrink-0 px-6 pb-3 pt-6 [@media(max-height:780px)]:pt-4">
        {chatClaim ? (
          <button
            type="button"
            onClick={() => setChatClaimId(null)}
            className="-ml-1 flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[22px] font-black leading-tight text-[#4A3333]"
          >
            <ChevronLeft className="h-6 w-6" />
            Разбор
          </button>
        ) : (
          <h2 className="m-0 text-[22px] font-black leading-tight text-[#4A3333]">Разбор</h2>
        )}
        <p className="m-0 mt-1 text-[13px] font-semibold text-[#A27C7A]">
          {factChecks.length} {plural(factChecks.length, ["утверждение", "утверждения", "утверждений"])} ·{" "}
          {totalSources} {plural(totalSources, ["источник", "источника", "источников"])}
        </p>
        {analyzedUntil !== undefined && (
          <p className="m-0 mt-2 flex items-center gap-2 text-[12px] font-bold text-[#1660D6]">
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[#1660D6] border-t-transparent" />
            {analyzedUntil > 0
              ? `Анализ идёт: разобрано до ${formatTimecode(analyzedUntil)}${
                  durationSec ? ` из ${formatTimecode(durationSec)}` : ""
                }`
              : "Анализ идёт"}
          </p>
        )}
      </div>

      {chatClaim ? (
        <AssistantChat
          key={chatClaim.id}
          jobId={jobId}
          claimId={chatClaim.id}
          suggestedQuestions={suggestedQuestions}
          intro={
            <ClaimRow
              factCheck={chatClaim}
              open
              onToggle={() => {}}
              onSeek={() => seekTo(chatClaim)}
              onOpenTree={() => onOpenTree(chatClaim.id)}
            />
          }
        />
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              onWheel={releaseSync}
              onTouchMove={releaseSync}
              onKeyDown={(e) => {
                if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key))
                  releaseSync();
              }}
              // клик по полосе прокрутки — тоже ручная прокрутка
              onPointerDown={(e) => e.target === e.currentTarget && releaseSync()}
              className="absolute inset-0 overflow-y-auto overscroll-contain px-3"
            >
              {factChecks.length === 0 && (
                <p className="px-3 py-10 text-center text-[13px] font-semibold text-[#A27C7A]">
                  Утверждения появятся здесь по ходу анализа
                </p>
              )}
              <div ref={listRef} className="flex flex-col gap-1">
                {factChecks.map((fc) => (
                  <ClaimRow
                    key={fc.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(fc.id, el);
                      else itemRefs.current.delete(fc.id);
                    }}
                    factCheck={fc}
                    open={fc.id === openId}
                    onToggle={() => setPinnedId(fc.id === openId ? "" : fc.id)}
                    onSeek={() => seekTo(fc)}
                    onOpenTree={() => onOpenTree(fc.id)}
                  />
                ))}
              </div>
              {/* место под последним утверждением, чтобы оно вставало наверх; высоту ставит align */}
              <div ref={spacerRef} aria-hidden className="h-16" />
            </div>

            {/* прошедшие утверждения уходят под шапку — мягкий край, а не обрезанная строка */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-[#FBF8F7] to-transparent" />

            {!synced && (
              <button
                type="button"
                onClick={() => {
                  setPinnedId(null);
                  setSynced(true);
                }}
                className="absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border-none bg-[#1660D6] px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0px_8px_20px_rgba(22,96,214,0.28)] transition-colors hover:bg-[#0F4FB5]"
              >
                <RadioTower className="h-4 w-4" />
                Синхронизировать с видео
              </button>
            )}
          </div>

          <AskBar disabled={factChecks.length === 0} onAsk={ask} />
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------

const ClaimRow = React.forwardRef<
  HTMLElement,
  {
    factCheck: FactCheck;
    open: boolean;
    onToggle: () => void;
    onSeek: () => void;
    onOpenTree: () => void;
  }
>(function ClaimRow({ factCheck: fc, open, onToggle, onSeek, onOpenTree }, ref) {
  const [showSources, setShowSources] = useState(false);
  const flags = uniqueFlags(fc);
  const tree = hasProvenanceTree(fc.provenance);
  const flagged = fc.status === "done" && flags.length > 0;
  // у раскрытого с серьёзными флагами пояснение заменяют сами флаги; мягкие идут под пояснением
  const summary = open && fc.consensus === "flagged" && flagged ? null : summaryLine(fc);

  return (
    <article
      ref={ref}
      className={`grid grid-cols-[46px_minmax(0,1fr)] gap-x-2 rounded-[20px] px-3 py-3 transition-colors ${
        open ? "bg-[#F1EBE9]" : "hover:bg-[#F6F1F0]"
      }`}
    >
      <button
        type="button"
        onClick={onSeek}
        title="Смотреть с этого момента"
        className="h-fit cursor-pointer border-none bg-transparent p-0 pt-[3px] text-left text-[13px] font-extrabold tabular-nums text-[#A27C7A] transition-colors hover:text-[#1660D6]"
      >
        {formatTimecode(fc.range.start)}
      </button>

      <div className="flex min-w-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex cursor-pointer flex-col items-start gap-1.5 border-none bg-transparent p-0 text-left"
        >
          {/* у раскрытого — сначала утверждение, плашка под ним; у свёрнутых — плашка сверху, как метка */}
          {!open && <StatusPill factCheck={fc} />}
          <span className="text-[15px] font-extrabold leading-snug text-[#4A3333]">
            {cleanQuote(fc.quote)}
          </span>
          {open && <StatusPill factCheck={fc} />}
        </button>

        {summary && <p className="m-0 text-[13px] font-semibold leading-snug text-[#A27C7A]">{summary}</p>}

        {open && (
          <>
            {flagged && <FlagList factCheck={fc} className="text-[#4A3333]" />}

            {(tree || fc.sources.length > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                {tree && (
                  <button
                    type="button"
                    onClick={onOpenTree}
                    className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[13px] font-extrabold text-[#4A3333] hover:underline"
                  >
                    Откуда пошло — дерево источников
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {fc.sources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSources(!showSources)}
                    className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[13px] font-bold text-[#A27C7A] hover:text-[#4A3333]"
                  >
                    {fc.sources.length} {plural(fc.sources.length, ["источник", "источника", "источников"])}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${showSources ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </div>
            )}
            {showSources && (
              <div className="-mx-1 mt-1">
                <SourcesCard factCheck={fc} />
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
});

// ---------------------------------------------------------------------------

/** Вопрос ассистенту по разбору: отправка открывает чат по раскрытому утверждению */
function AskBar({ disabled, onAsk }: { disabled: boolean; onAsk: (q: string) => void }) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAsk(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="shrink-0 p-3 pt-2">
      <div className="flex items-center gap-2 rounded-full bg-[#F1EBE9] py-1.5 pl-5 pr-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder="Спросите про любое утверждение…"
          className="min-w-0 flex-1 border-none bg-transparent text-[14px] font-semibold text-[#4A3333] outline-none placeholder:text-[#A27C7A]"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          title="Спросить"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[#4A3333] text-white transition-colors hover:bg-[#362424] disabled:cursor-default disabled:opacity-60"
        >
          <ArrowUp className="h-[18px] w-[18px]" />
        </button>
      </div>
    </form>
  );
}
