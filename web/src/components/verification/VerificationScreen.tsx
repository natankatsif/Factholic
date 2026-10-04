import React, { useEffect, useMemo, useRef, useState } from "react";
import { isPendingCheck, type ClientMessage, type VideoReport } from "@news/contracts";
import { reportYoutubeId } from "../../lib/youtube";
import { VerificationHeader } from "./VerificationHeader";
import { ClaimTextPanel, findQuoteInText } from "./ClaimTextPanel";
import { AnalysisCard } from "./AnalysisCard";
import { ConsensusBar } from "./ConsensusBar";
import { TreeView } from "./TreeView";
import { VideoClaimFeed } from "./VideoClaimFeed";
import { VideoPlayerPanel, type VideoPlayerHandle } from "./VideoPlayerPanel";
import { materialKind } from "./material";
import { CornerEmojis, type BlobMood } from "./CornerEmojis";

export type VerificationView = "analysis" | "tree";

/** Разбор: слева материал, справа «Разбор»; на мобильных — одна колонка */
const TWO_COLUMNS =
  "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-5 px-6 pb-5 pt-1 sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(380px,35.6vw,456px)] lg:gap-8 lg:px-20 lg:pb-8";
/** Дерево: lg+ — во всю высоту, прокрутка внутри холста и панели; мобильные — обычная прокрутка */
const TREE_MAIN =
  "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-y-auto px-6 pb-5 sm:px-10 lg:px-20 lg:overflow-hidden";

export interface VerificationScreenProps {
  report: VideoReport;
  /** Вид экрана. Если задан вместе с onViewChange — управляется снаружи (например, через ?view=tree в адресе) */
  view?: VerificationView;
  onViewChange?: (view: VerificationView) => void;
  onGoHome?: () => void;
  sourceText?: string;
  /**
   * Сообщение бэкенду: позиция плеера (проверяются текущее утверждение и два следующих) и
   * «проверь это утверждение» — когда пользователь открыл найденное, но ещё не проверенное
   */
  onSend?: (msg: ClientMessage) => void;
}

/**
 * Экран разбора по макету.
 * lg+: ровно в высоту окна, страница не прокручивается — длинный текст и детали прокручиваются внутри карточек.
 *   слева: «Текст который спросили» (растягивается) + плашка позиций источников;
 *   справа: «Разбор» во всю высоту, внизу — вопросы ассистенту.
 * Видео YouTube: слева вместо текста — плеер с метками утверждений, справа — лента утверждений по таймкодам.
 * Мобильные: всё в одну колонку с обычной прокруткой.
 */
export function VerificationScreen({
  report,
  view,
  onViewChange,
  onGoHome,
  sourceText,
  onSend,
}: VerificationScreenProps) {
  const youtubeId = reportYoutubeId(report.video);

  // Сортируем все тезисы строго по порядку их появления в тексте (сверху вниз), у видео — по таймкодам
  const factChecks = useMemo(() => {
    const trimmed = (sourceText ?? report.sourceText)?.trim();
    if (!trimmed || youtubeId) {
      return [...report.factChecks].sort((a, b) => a.range.start - b.range.start);
    }
    return [...report.factChecks].sort((a, b) => {
      const matchA = findQuoteInText(trimmed, a.quote);
      const matchB = findQuoteInText(trimmed, b.quote);
      const startA = matchA ? matchA.start : Infinity;
      const startB = matchB ? matchB.start : Infinity;
      if (startA !== startB) return startA - startB;
      return a.range.start - b.range.start;
    });
  }, [report.factChecks, sourceText, report.sourceText, youtubeId]);

  // Открываем первое уже проверенное утверждение: разбор открывается, когда проверена только первая часть,
  // и первое по тексту может быть ещё серым. У видео — первое по времени: с него начинается просмотр
  const firstClaimId =
    (youtubeId ? undefined : factChecks.find((fc) => !isPendingCheck(fc))?.id) ?? factChecks[0]?.id ?? "";

  const [selectedClaimId, setSelectedClaimId] = useState<string>(firstClaimId);

  // Синхронизируем выбор первого тезиса при загрузке или обновлении списка
  useEffect(() => {
    if (!selectedClaimId || !factChecks.some((fc) => fc.id === selectedClaimId)) {
      if (firstClaimId) setSelectedClaimId(firstClaimId);
    }
  }, [firstClaimId, factChecks, selectedClaimId]);

  // Отслеживаем просмотренные тезисы (первый выбранный сразу считается просмотренным)
  const [viewedClaimIds, setViewedClaimIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (firstClaimId) initial.add(firstClaimId);
    return initial;
  });

  useEffect(() => {
    if (selectedClaimId) {
      setViewedClaimIds((prev) => {
        if (prev.has(selectedClaimId)) return prev;
        const next = new Set(prev);
        next.add(selectedClaimId);
        return next;
      });
    }
  }, [selectedClaimId]);

  const [localView, setLocalView] = useState<VerificationView>(view ?? "analysis");
  const isTreeView = (onViewChange ? view : localView) === "tree";
  const setView = (v: VerificationView) => (onViewChange ? onViewChange(v) : setLocalView(v));

  // Видео: время плеера ведёт ленту. В дереве плеер не пропадает — уменьшается в мини-плеер и играет дальше
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [videoTime, setVideoTime] = useState(0);
  const videoClaimId = [...factChecks].reverse().find((fc) => fc.range.start <= videoTime + 0.3)?.id;
  const currentClaim = factChecks.find((fc) => fc.id === (selectedClaimId || videoClaimId)) ?? factChecks[0];
  const blobMood: BlobMood = !currentClaim
    ? "converge"
    : isPendingCheck(currentClaim)
      ? "checking"
      : currentClaim.consensus;

  // Видео дошло до другого утверждения (или перемотали) — бэкенд проверяет его и два следующих
  const videoTimeRef = useRef(videoTime);
  videoTimeRef.current = videoTime;
  const sendRef = useRef(onSend);
  sendRef.current = onSend;
  useEffect(() => {
    if (!youtubeId) return;
    sendRef.current?.({ type: "playback", currentTime: videoTimeRef.current, playing: true, rate: 1 });
  }, [youtubeId, videoClaimId]);

  // Открыли найденное, но не проверенное утверждение — проверить первым
  const selectedStatus = factChecks.find((fc) => fc.id === selectedClaimId)?.status;
  useEffect(() => {
    if (selectedClaimId && selectedStatus === "found")
      sendRef.current?.({ type: "claim.check", claimId: selectedClaimId });
  }, [selectedClaimId, selectedStatus]);

  const openTree = (claimId: string) => {
    setSelectedClaimId(claimId);
    setView("tree");
  };

  const totalSources =
    report.summary?.totalSources ?? new Set(factChecks.flatMap((fc) => fc.sources.map((s) => s.url))).size;

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#F1EBE9] font-sans text-[#4A3333] lg:h-[100svh] lg:overflow-hidden">
      <VerificationHeader onGoHome={onGoHome} currentJobId={report.jobId} />

      {youtubeId ? (
        // Видео: один <main> на оба вида — плеер остаётся тем же элементом (YouTube не перезагружается),
        // в дереве он становится мини-плеером в углу, на месте ленты — дерево
        <>
          <main className={isTreeView && currentClaim ? TREE_MAIN : TWO_COLUMNS}>
            <VideoPlayerPanel
              ref={playerRef}
              videoId={youtubeId}
              video={report.video}
              factChecks={factChecks}
              currentClaimId={videoClaimId}
              onTime={setVideoTime}
              onOpenTree={openTree}
              mini={isTreeView && Boolean(currentClaim)}
              onExpand={() => setView("analysis")}
            />
            {isTreeView && currentClaim ? (
              <TreeView
                factCheck={currentClaim}
                material={materialKind(report.video)}
                onBack={() => setView("analysis")}
              />
            ) : (
              <VideoClaimFeed
                jobId={report.jobId}
                factChecks={factChecks}
                currentTime={videoTime}
                totalSources={totalSources}
                suggestedQuestions={report.summary?.suggestedQuestions}
                analyzedUntil={report.status === "completed" ? undefined : report.processedUntil}
                durationSec={report.video.durationSec}
                onSeek={(sec) => playerRef.current?.seekTo(sec)}
                onOpenTree={openTree}
                onActiveClaimChange={setSelectedClaimId}
              />
            )}
          </main>

          {!isTreeView && (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center overflow-visible">
              <div className="relative w-full max-w-[1440px] px-6 sm:px-10 lg:px-20 overflow-visible">
                <div className="flex justify-end lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(380px,35.6vw,456px)] lg:gap-8 overflow-visible">
                  <div className="hidden lg:block" />
                  <div className="relative overflow-visible">
                    <div className="pointer-events-none absolute -left-[70px] bottom-0 max-lg:left-auto max-lg:right-4 overflow-visible">
                      <CornerEmojis placement="screen-bottom" mood={blobMood} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : isTreeView && currentClaim ? (
        // lg+: колонка во всю высоту экрана, прокрутка — внутри холста и панели дерева; мобильные — обычная прокрутка
        <main className={TREE_MAIN}>
          <TreeView
            factCheck={currentClaim}
            material={materialKind(report.video)}
            onBack={() => setView("analysis")}
          />
        </main>
      ) : (
        <main className={TWO_COLUMNS}>
          <div className="flex min-h-0 flex-col gap-5 lg:gap-[22px]">
            <ClaimTextPanel
              factChecks={factChecks}
              selectedClaimId={currentClaim?.id ?? ""}
              onSelectClaimId={setSelectedClaimId}
              isDimmed={() => false}
              sourceText={sourceText ?? report.sourceText}
              viewedClaimIds={viewedClaimIds}
            />
            <ConsensusBar
              factChecks={factChecks}
              totalSources={totalSources}
              material={materialKind(report.video)}
              onSelectClaimId={setSelectedClaimId}
              viewedClaimIds={viewedClaimIds}
            />
          </div>

          <AnalysisCard
            jobId={report.jobId}
            factCheck={currentClaim}
            totalClaims={report.summary?.totalClaims ?? factChecks.length}
            totalSources={totalSources}
            onOpenProvenanceTree={() => setView("tree")}
            suggestedQuestions={report.summary?.suggestedQuestions}
            material={materialKind(report.video)}
          />
        </main>
      )}
    </div>
  );
}
