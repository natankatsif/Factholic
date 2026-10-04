import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { isPendingCheck, type ClaimConsensus, type FactCheck } from "@news/contracts";
import { CORNER_BLOB_PEEK, CornerEmojis, type BlobMood } from "./CornerEmojis";

export interface ClaimTextPanelProps {
  factChecks: FactCheck[];
  selectedClaimId: string;
  onSelectClaimId: (id: string) => void;
  /** Утверждения, не подходящие под фильтр, приглушаются */
  isDimmed: (fc: FactCheck) => boolean;
  sourceText?: string;
  viewedClaimIds?: Set<string>;
  pageUrl?: string;
}

/** Подсветка утверждения по позиции источников: фон + подчёркивание */
const TONE: Record<ClaimConsensus, { bg: string; line: string }> = {
  converge: { bg: "#E6F7F0", line: "#1DA57A" },
  split: { bg: "#FFF4D1", line: "#FFC20E" },
  against: { bg: "#FDE3E5", line: "#E2353F" },
  flagged: { bg: "#FFE7D3", line: "#FF7A12" },
  unverifiable: { bg: "#EEE8E6", line: "#A27C7A" },
};

/** Линия утверждения, которое ещё не проверено — как кружок в колонке слева */
const PENDING_LINE = "#C9B8B6";

/**
 * Подсветка утверждения по ходу проверки: проверено — цвет позиции источников; проверяется сейчас — серый
 * «дышащий» фон; найдено, но ждёт очереди (или клика) — только пунктир снизу. Цвет меняется плавно, текст — нет.
 */
function highlightOf(fc: FactCheck): { className: string; style: React.CSSProperties } {
  const ring = (color: string) => ({ ["--tw-ring-color" as string]: color });
  if (fc.status === "checking")
    return {
      className: "animate-claim-checking",
      style: { textDecorationColor: PENDING_LINE, ...ring(PENDING_LINE) },
    };
  if (fc.status === "found")
    return {
      className: "decoration-dashed",
      style: { backgroundColor: "transparent", textDecorationColor: PENDING_LINE, ...ring(PENDING_LINE) },
    };
  const tone = TONE[fc.consensus] ?? TONE.unverifiable;
  return {
    className: "",
    style: { backgroundColor: tone.bg, textDecorationColor: tone.line, ...ring(tone.line) },
  };
}

/** «Вчера сгорел…» → Вчера сгорел… — кавычки и обрыв цитаты в тексте не нужны */
export function cleanQuote(quote: string): string {
  return quote
    .replace(/^[«"“]+|[»"”]+$/g, "")
    .replace(/\.{3}|…$/g, "")
    .trim();
}

export function findQuoteInText(source: string, quote: string): { start: number; end: number } | null {
  const cleaned = cleanQuote(quote);
  if (!cleaned || cleaned.length < 3) return null;

  // 1. Прямое точное совпадение
  let idx = source.indexOf(cleaned);
  if (idx !== -1) return { start: idx, end: idx + cleaned.length };

  // 2. Регистронезависимое совпадение
  const lowerSource = source.toLowerCase();
  const lowerCleaned = cleaned.toLowerCase();
  idx = lowerSource.indexOf(lowerCleaned);
  if (idx !== -1) return { start: idx, end: idx + cleaned.length };

  // 3. Совпадение без краевой пунктуации
  const core = cleaned.replace(/^[^a-zA-Zа-яА-Я0-9]+|[^a-zA-Zа-яА-Я0-9]+$/g, "");
  if (core.length >= 5) {
    idx = lowerSource.indexOf(core.toLowerCase());
    if (idx !== -1) return { start: idx, end: idx + core.length };
  }

  // 4. Поиск по началу цитаты (если цитата была обрезана)
  if (cleaned.length > 25) {
    const prefix = cleaned.slice(0, 25).toLowerCase();
    idx = lowerSource.indexOf(prefix);
    if (idx !== -1) {
      let len = 25;
      while (
        idx + len < source.length &&
        len < cleaned.length &&
        lowerSource[idx + len] === lowerCleaned[len]
      ) {
        len++;
      }
      return { start: idx, end: idx + len };
    }
  }

  return null;
}

type TextSegment = { isClaim: false; text: string } | { isClaim: true; text: string; claim: FactCheck };

/**
 * «Текст который спросили»: если передан sourceText, отображается полный текст
 * с подсвеченными и кликабельными утверждениями внутри него.
 * Если sourceText нет или совпадений не найдено, отображаются плашки тезисов.
 */
export function ClaimTextPanel({
  factChecks,
  selectedClaimId,
  onSelectClaimId,
  isDimmed,
  sourceText,
  viewedClaimIds,
  pageUrl,
}: ClaimTextPanelProps) {
  // Находим вхождения утверждений в исходном тексте
  const textHighlights = React.useMemo(() => {
    const trimmed = sourceText?.trim();
    if (!trimmed) return null;

    const rawMatches: { start: number; end: number; claim: FactCheck }[] = [];
    const matchedClaimIds = new Set<string>();

    for (const fc of factChecks) {
      const match = findQuoteInText(trimmed, fc.quote);
      if (match) {
        rawMatches.push({ ...match, claim: fc });
      }
    }

    if (rawMatches.length === 0) return null;

    // Сортируем по позиции начала
    rawMatches.sort((a, b) => a.start - b.start);

    // Убираем перекрывающиеся совпадения
    const nonOverlapping: { start: number; end: number; claim: FactCheck }[] = [];
    let currentEnd = 0;
    for (const m of rawMatches) {
      if (m.start >= currentEnd) {
        nonOverlapping.push(m);
        currentEnd = m.end;
        matchedClaimIds.add(m.claim.id);
      }
    }

    const segments: TextSegment[] = [];
    let lastEnd = 0;
    for (const m of nonOverlapping) {
      if (m.start > lastEnd) {
        segments.push({ isClaim: false, text: trimmed.slice(lastEnd, m.start) });
      }
      segments.push({ isClaim: true, text: trimmed.slice(m.start, m.end), claim: m.claim });
      lastEnd = m.end;
    }
    if (lastEnd < trimmed.length) {
      segments.push({ isClaim: false, text: trimmed.slice(lastEnd) });
    }

    const unmatchedClaims = factChecks.filter((fc) => !matchedClaimIds.has(fc.id));

    return { segments, unmatchedClaims };
  }, [sourceText, factChecks]);

  // наведение на кружок слева или на сам тезис в тексте: всё бледнеет, кроме этого тезиса
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoveredId(id),
    onMouseLeave: () => setHoveredId(null),
    onFocus: () => setHoveredId(id),
    onBlur: () => setHoveredId(null),
  });
  // настроение чудика — по выбранному утверждению
  const selectedClaim = factChecks.find((fc) => fc.id === selectedClaimId);
  const blobMood: BlobMood = !selectedClaim
    ? "converge"
    : isPendingCheck(selectedClaim)
      ? "checking"
      : selectedClaim.consensus;
  const faded = (fc?: FactCheck) => hoveredId !== null && fc?.id !== hoveredId;

  // Морф текста при смене проверки (например, из истории): старый текст тает, новый проявляется.
  // Копию старого снимаем из DOM ещё при рендере — после коммита React его уже заменит.
  const sectionRef = React.useRef<HTMLElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  // есть полный текст — морфим только когда сменился он сам (другая проверка), а не когда пришло ещё одно
  // утверждение: иначе текст размывался и прокручивался наверх посреди чтения
  const contentKey = sourceText?.trim()
    ? `text#${sourceText}`
    : `claims#${factChecks.map((fc) => fc.id).join("|")}`;
  const shownKey = React.useRef(contentKey);
  const ghost = React.useRef<{ node: HTMLElement; scrollTop: number } | null>(null);
  if (shownKey.current !== contentKey && textRef.current && !ghost.current) {
    ghost.current = {
      node: textRef.current.cloneNode(true) as HTMLElement,
      scrollTop: textRef.current.scrollTop,
    };
  }
  React.useLayoutEffect(() => {
    if (shownKey.current === contentKey) return;
    shownKey.current = contentKey;
    const old = ghost.current;
    ghost.current = null;
    const section = sectionRef.current;
    const text = textRef.current;
    if (!old || !section || !text || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // копия старого текста — ровно поверх нового, без кликов
    const g = old.node;
    g.removeAttribute("id");
    Object.assign(g.style, {
      position: "absolute",
      left: `${text.offsetLeft}px`,
      top: `${text.offsetTop}px`,
      width: `${text.offsetWidth}px`,
      height: `${text.offsetHeight}px`,
      margin: "0",
      pointerEvents: "none",
    });
    g.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    section.appendChild(g);
    g.scrollTop = old.scrollTop;
    text.scrollTop = 0;

    const out = g.animate(
      [
        { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
        { opacity: 0, filter: "blur(4px)", transform: "translateY(-4px)" },
      ],
      { duration: 220, easing: "ease-in", fill: "forwards" },
    );
    out.onfinish = () => g.remove();
    text.animate(
      [
        { opacity: 0, filter: "blur(4px)", transform: "translateY(4px)" },
        { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
      ],
      { duration: 320, delay: 80, easing: "ease-out", fill: "backwards" },
    );
    return () => g.remove();
  }, [contentKey]);

  return (
    <div className="relative flex min-h-0 flex-1 w-full">
      {/* Левые круглые метки тезисов — вынесены на левое поле страницы, без свечения и мигания */}
      <ClaimRail selectedClaimId={selectedClaimId}>
        {factChecks.map((fc, idx) => {
          const isUnviewed = viewedClaimIds ? !viewedClaimIds.has(fc.id) : false;
          const isSelected = fc.id === selectedClaimId;
          // цвет — позиция источников, как подсветка тезиса в тексте; пока проверяется — серый
          const color = isPendingCheck(fc) ? "#C9B8B6" : (TONE[fc.consensus] ?? TONE.unverifiable).line;
          return (
            <button
              key={fc.id}
              type="button"
              data-claim-id={fc.id}
              onClick={() => {
                onSelectClaimId(fc.id);
                const el = document.getElementById(`claim-highlight-${fc.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              {...hoverProps(fc.id)}
              title={`Тезис ${idx + 1}: «${cleanQuote(fc.quote)}»${isUnviewed ? " (не просмотрено)" : ""}`}
              className={`relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none text-xs font-black text-white transition-all duration-200 hover:scale-110 ${
                isSelected ? "ring-2 ring-offset-2 ring-offset-[#F1EBE9]" : ""
              } ${faded(fc) ? "opacity-35" : ""}`}
              style={{ backgroundColor: color, ["--tw-ring-color" as string]: color }}
            >
              <span>{idx + 1}</span>
              {/* ещё не просмотрен — синяя точка в углу */}
              {isUnviewed && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F1EBE9] bg-[#1660D6]" />
              )}
            </button>
          );
        })}
      </ClaimRail>

      <section
        ref={sectionRef}
        className="relative flex min-h-[280px] w-full flex-1 flex-col overflow-hidden rounded-[28px] bg-[#FBF8F7] p-6 sm:p-[30px] lg:min-h-0"
      >
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h2 className="text-lg font-black uppercase tracking-[-0.2px] text-[#4A3333] sm:text-[20px]">
            Текст который спросили
          </h2>
          {pageUrl && (
            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              title="Открыть оригинал"
              className="flex items-center gap-1.5 rounded-full bg-[#F1EBE9] px-3.5 py-1.5 text-xs font-extrabold text-[#4A3333] no-underline transition-all hover:bg-[#E8DFDC]"
            >
              <img src="/blob.png" alt="" className="h-4 w-4 shrink-0 rounded-full select-none" />
              <span>Оригинал</span>
            </a>
          )}
        </div>

        {/* запас p-1 под обводку выбранного утверждения;
            снизу — место под смайлик в углу: текст прокручивается выше и под него не заходит */}
        <div
          ref={textRef}
          className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto p-1"
          style={{ marginBottom: CORNER_BLOB_PEEK - 24 }}
        >
          {textHighlights ? (
            <div className="whitespace-pre-wrap text-[17px] font-semibold leading-[1.8] text-[#4A3333] sm:text-[19px]">
              {textHighlights.segments.map((seg, idx) => {
                if (!seg.isClaim) {
                  return (
                    <span
                      key={idx}
                      className={`transition-opacity duration-200 ${hoveredId ? "opacity-30" : ""}`}
                    >
                      {seg.text}
                    </span>
                  );
                }
                const fc = seg.claim;
                const hl = highlightOf(fc);
                const selected = fc.id === selectedClaimId;
                return (
                  <span
                    key={fc.id}
                    id={`claim-highlight-${fc.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectClaimId(fc.id)}
                    {...hoverProps(fc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectClaimId(fc.id);
                      }
                    }}
                    className={`cursor-pointer rounded-md px-1 py-[1px] underline decoration-[3px] underline-offset-[5px] outline-none transition-all duration-300 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] ${hl.className} ${
                      isDimmed(fc) || faded(fc) ? "opacity-35" : ""
                    } ${selected ? "ring-2 ring-inset" : "hover:brightness-95"}`}
                    style={hl.style}
                  >
                    {seg.text}
                  </span>
                );
              })}

              {textHighlights.unmatchedClaims.length > 0 && (
                <div className="mt-6 border-t border-[#E8DFDC] pt-4">
                  <div
                    className={`mb-2 transition-opacity duration-200 ${hoveredId ? "opacity-30" : ""} text-xs font-bold uppercase tracking-wider text-[#A27C7A]`}
                  >
                    Другие тезисы
                  </div>
                  <div className="flex flex-wrap items-start gap-x-1.5 gap-y-2 text-[15px] font-semibold sm:text-[17px]">
                    {textHighlights.unmatchedClaims.map((fc) => {
                      const hl = highlightOf(fc);
                      const selected = fc.id === selectedClaimId;
                      return (
                        <button
                          key={fc.id}
                          id={`claim-highlight-${fc.id}`}
                          type="button"
                          onClick={() => onSelectClaimId(fc.id)}
                          {...hoverProps(fc.id)}
                          className={`cursor-pointer rounded-md border-none px-2 py-1 text-left font-[inherit] leading-[inherit] text-inherit underline decoration-[3px] underline-offset-[5px] transition-all duration-300 ${hl.className} ${
                            isDimmed(fc) || faded(fc) ? "opacity-35" : ""
                          } ${selected ? "ring-2 ring-inset" : "hover:brightness-95"}`}
                          style={hl.style}
                        >
                          {cleanQuote(fc.quote)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Режим только тезисов (если нет полного текста) */
            <div className="flex flex-wrap items-start gap-x-1.5 gap-y-3 text-[17px] font-semibold leading-[1.6] text-[#4A3333] sm:text-[19px]">
              {factChecks.map((fc) => {
                const hl = highlightOf(fc);
                const selected = fc.id === selectedClaimId;
                return (
                  <React.Fragment key={fc.id}>
                    <button
                      key={fc.id}
                      id={`claim-highlight-${fc.id}`}
                      type="button"
                      onClick={() => onSelectClaimId(fc.id)}
                      {...hoverProps(fc.id)}
                      className={`cursor-pointer rounded-md border-none px-1.5 py-1 text-left font-[inherit] leading-[inherit] text-inherit underline decoration-[3px] underline-offset-[6px] transition-all duration-300 [box-decoration-break:clone] ${hl.className} ${
                        isDimmed(fc) || faded(fc) ? "opacity-35" : ""
                      } ${selected ? "ring-2 ring-inset" : "hover:brightness-95"}`}
                      style={hl.style}
                    >
                      {cleanQuote(fc.quote)}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <CornerEmojis mood={blobMood} />
      </section>
    </div>
  );
}

/** Стрелка листает почти на высоту рейки: крайний кружок остаётся на экране, чтобы не терять место */
const RAIL_STEP_OVERLAP = 40;

/**
 * Колонка кружков тезисов — не длиннее панели текста. Не помещаются: прокрутка колёсиком (без полосы)
 * и стрелками вверх/вниз; выбранный тезис рейка прокручивает в поле зрения сама.
 */
function ClaimRail({ selectedClaimId, children }: { selectedClaimId: string; children: React.ReactNode }) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ up: false, down: false });

  const update = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const up = el.scrollTop > 1;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
  }, []);

  // кружков стало больше (тезисы приходят по ходу проверки) — пересчитываем после каждого рендера
  React.useLayoutEffect(update);
  // окно поменяло высоту — тоже
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  React.useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-claim-id="${CSS.escape(selectedClaimId)}"]`);
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top >= list.scrollTop && bottom <= list.scrollTop + list.clientHeight) return;
    list.scrollTo({ top: top - (list.clientHeight - item.offsetHeight) / 2, behavior: "smooth" });
  }, [selectedClaimId]);

  const scroll = (dir: 1 | -1) => {
    const el = listRef.current;
    el?.scrollBy({ top: dir * Math.max(el.clientHeight - RAIL_STEP_OVERLAP, 40), behavior: "smooth" });
  };

  const arrow = (dir: 1 | -1) => {
    const disabled = dir < 0 ? !edges.up : !edges.down;
    const Icon = dir < 0 ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        onClick={() => scroll(dir)}
        disabled={disabled}
        aria-label={dir < 0 ? "Предыдущие тезисы" : "Следующие тезисы"}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[#FBF8F7] text-[#4A3333] transition-opacity hover:bg-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-[#FBF8F7]"
      >
        <Icon size={16} strokeWidth={3} />
      </button>
    );
  };

  const overflow = edges.up || edges.down;
  return (
    <div
      className="absolute -left-[54px] bottom-0 top-0 z-10 hidden w-11 select-none flex-col items-center gap-1 lg:flex"
      aria-label="Навигация по тезисам"
    >
      {overflow && arrow(-1)}
      {/* запас py-2 и ширина w-11 — под обводку выбранного кружка и увеличение при наведении */}
      <div
        ref={listRef}
        onScroll={update}
        className="relative flex min-h-0 w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {overflow && arrow(1)}
    </div>
  );
}
