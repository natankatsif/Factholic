"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import {
  formatTimecode,
  isPendingCheck,
  type ClaimConsensus,
  type FactCheck,
  type VideoInfo,
} from "@news/contracts";
import {
  ArrowUpRight,
  Captions,
  Check,
  CircleCheck,
  GitFork,
  GripHorizontal,
  Maximize,
  Maximize2,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Share2,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { YT_STATE, loadYoutubeApi, qualityLabel, type YTPlayer } from "../../lib/youtube";
import { CONSENSUS_STYLE } from "./AnalysisCard";
import { FlagList, StatusPill, summaryLine } from "./claim-status";
import { cleanQuote } from "./ClaimTextPanel";
import { plural } from "./filters";
import { hasProvenanceTree } from "./material";

export interface VideoPlayerHandle {
  /** Перемотать на секунду видео и запустить воспроизведение */
  seekTo: (sec: number) => void;
}

export interface VideoPlayerPanelProps {
  videoId: string;
  video: VideoInfo;
  /** Утверждения по порядку таймкодов */
  factChecks: FactCheck[];
  /** Утверждение, до которого дошло видео — плашка над полосой */
  currentClaimId?: string;
  /** С какой секунды начать (возврат из дерева источников) */
  startAt?: number;
  autoplay?: boolean;
  /** Текущее время видео, несколько раз в секунду */
  onTime: (sec: number) => void;
  /** Открыть дерево источников утверждения (из карточки во весь экран) */
  onOpenTree?: (claimId: string) => void;
  /**
   * Мини-плеер: пока открыто дерево источников, плеер не пропадает, а уменьшается в плавающее окошко
   * в углу — видео идёт дальше. Тот же элемент, поэтому YouTube не перезагружается.
   */
  mini?: boolean;
  /** Клик «развернуть» в мини-плеере — обратно к разбору */
  onExpand?: () => void;
}

type PlayState = "unstarted" | "playing" | "paused" | "buffering" | "ended";

/** Короткие подписи позиций источников: плашка утверждения и легенда */
const SHORT_LABEL: Record<ClaimConsensus, string> = {
  converge: "Подтверждают",
  split: "Разделились",
  against: "Возражают",
  flagged: "С флагами",
  unverifiable: "Мало данных",
};

const CHECKING_COLOR = "#C9B8B6";
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
/** Через сколько без движения мыши прячем управление во время воспроизведения */
const IDLE_MS = 2500;
/** Переход в мини-плеер и обратно — токены transitions.dev для смены позиции и размера */
const MORPH_MS = 400; // --duration-slow
const MORPH_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // --ease-smooth-out

function claimColor(fc: FactCheck): string {
  return isPendingCheck(fc)
    ? CHECKING_COLOR
    : (CONSENSUS_STYLE[fc.consensus] ?? CONSENSUS_STYLE.unverifiable).color;
}

function claimLabel(fc: FactCheck): string {
  if (fc.status === "found") return "Не проверено";
  return fc.status === "checking" ? "Проверяем" : (SHORT_LABEL[fc.consensus] ?? SHORT_LABEL.unverifiable);
}

/**
 * Левая колонка разбора видео: свой плеер поверх YouTube (IFrame API без родного управления).
 * Поверх видео — счётчик проверенных утверждений, текущее утверждение, полоса с метками утверждений
 * (клик — перемотка, наведение — цитата), управление и легенда позиций источников. Ниже — название и действия.
 * Клавиши: пробел/K — пауза, ←/→ — 5 с, M — звук, F — полный экран, N — следующее утверждение.
 */
export const VideoPlayerPanel = forwardRef<VideoPlayerHandle, VideoPlayerPanelProps>(
  function VideoPlayerPanel(
    {
      videoId,
      video,
      factChecks,
      currentClaimId,
      startAt = 0,
      autoplay = true,
      onTime,
      onOpenTree,
      mini = false,
      onExpand,
    },
    ref,
  ) {
    const frameRef = useRef<HTMLDivElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const pendingSeek = useRef<number | null>(null);
    const onTimeRef = useRef(onTime);
    onTimeRef.current = onTime;

    const [time, setTime] = useState(startAt);
    const [duration, setDuration] = useState(video.durationSec || 0);
    const [state, setState] = useState<PlayState>("unstarted");
    const [ready, setReady] = useState(false);
    const checkedCount = factChecks.filter((fc) => !isPendingCheck(fc)).length;
    // видео хоть раз пошло: до этого поверх — наша обложка (у YouTube там название и красная кнопка)
    const [started, setStarted] = useState(false);
    const [volume, setVolumeState] = useState(100);
    const [muted, setMuted] = useState(false);
    const [rate, setRate] = useState(1);
    const [captions, setCaptions] = useState(false);
    const [quality, setQuality] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [active, setActive] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    /** Во весь экран: карточка подробностей текущего утверждения поверх видео (видео не останавливается) */
    const [detailsOpen, setDetailsOpen] = useState(false);
    const idleTimer = useRef<ReturnType<typeof setTimeout>>();

    // ---------- плеер YouTube ----------

    // YT заменяет переданный элемент на iframe — создаём его сами внутри host, чтобы React не столкнулся с чужим DOM
    useEffect(() => {
      let cancelled = false;
      let poll: ReturnType<typeof setInterval> | null = null;
      const host = hostRef.current;
      if (!host) return;
      const mount = document.createElement("div");
      host.appendChild(mount);

      loadYoutubeApi()
        .then((YT) => {
          if (cancelled) return;
          playerRef.current = new YT.Player(mount, {
            videoId,
            width: "100%",
            height: "100%",
            playerVars: {
              autoplay: autoplay ? 1 : 0,
              start: Math.floor(startAt),
              controls: 0,
              disablekb: 1,
              fs: 0,
              rel: 0,
              iv_load_policy: 3,
              cc_load_policy: 0,
              modestbranding: 1,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (e) => {
                if (cancelled) return;
                const p = e.target;
                setReady(true);
                const d = p.getDuration();
                if (d > 0) setDuration(d);
                setVolumeState(p.getVolume());
                setMuted(p.isMuted());
                p.unloadModule("captions");
                if (pendingSeek.current !== null) {
                  p.seekTo(pendingSeek.current, true);
                  p.playVideo();
                  pendingSeek.current = null;
                } else if (autoplay) {
                  p.playVideo();
                }
                poll = setInterval(() => {
                  const player = playerRef.current;
                  if (!player) return;
                  const t = player.getCurrentTime();
                  if (!Number.isFinite(t)) return;
                  setTime(t);
                  onTimeRef.current(t);
                  setQuality(qualityLabel(player.getPlaybackQuality?.() ?? ""));
                }, 250);
              },
              onStateChange: (e) => {
                if (cancelled) return;
                const next: PlayState =
                  e.data === YT_STATE.PLAYING
                    ? "playing"
                    : e.data === YT_STATE.PAUSED
                      ? "paused"
                      : e.data === YT_STATE.BUFFERING
                        ? "buffering"
                        : e.data === YT_STATE.ENDED
                          ? "ended"
                          : "unstarted";
                setState(next);
                if (next === "playing") setStarted(true);
                if (next === "playing") {
                  const d = e.target.getDuration();
                  if (d > 0) setDuration(d);
                }
              },
            },
          });
        })
        .catch((err: Error) => {
          if (!cancelled) setLoadError(err.message);
        });

      return () => {
        cancelled = true;
        if (poll) clearInterval(poll);
        playerRef.current?.destroy();
        playerRef.current = null;
        host.replaceChildren();
      };
      // startAt и autoplay нужны только при создании плеера
    }, [videoId]);

    // ---------- действия ----------

    const seek = (sec: number) => {
      const player = playerRef.current;
      const t = Math.max(0, Math.min(sec, duration || sec));
      setTime(t);
      onTimeRef.current(t);
      if (!player) {
        pendingSeek.current = t;
        return;
      }
      player.seekTo(t, true);
      player.playVideo();
    };

    useImperativeHandle(ref, () => ({ seekTo: seek }));

    const togglePlay = () => {
      const player = playerRef.current;
      if (!player) return;
      if (state === "ended") seek(0);
      else if (state === "playing" || state === "buffering") player.pauseVideo();
      else player.playVideo();
    };

    const toggleMute = () => {
      const player = playerRef.current;
      if (!player) return;
      if (muted || volume === 0) {
        player.unMute();
        if (volume === 0) {
          player.setVolume(50);
          setVolumeState(50);
        }
        setMuted(false);
      } else {
        player.mute();
        setMuted(true);
      }
    };

    const changeVolume = (v: number) => {
      const player = playerRef.current;
      if (!player) return;
      player.setVolume(v);
      setVolumeState(v);
      if (v > 0 && muted) {
        player.unMute();
        setMuted(false);
      }
    };

    const changeRate = (r: number) => {
      playerRef.current?.setPlaybackRate(r);
      setRate(r);
      setMenuOpen(false);
    };

    const toggleCaptions = () => {
      const player = playerRef.current;
      if (!player) return;
      if (captions) player.unloadModule("captions");
      else player.loadModule("captions");
      setCaptions(!captions);
    };

    const toggleFullscreen = () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void frameRef.current?.requestFullscreen();
    };

    useEffect(() => {
      const onChange = () => {
        const on = document.fullscreenElement === frameRef.current;
        setFullscreen(on);
        if (!on) setDetailsOpen(false);
      };
      document.addEventListener("fullscreenchange", onChange);
      return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const nextClaim = factChecks.find((fc) => fc.range.start > time + 0.5);

    // управление прячется, когда видео идёт и мышь не двигается
    const wake = () => {
      setActive(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setActive(false), IDLE_MS);
    };
    useEffect(() => () => clearTimeout(idleTimer.current), []);

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      // пробел и Enter на кнопке управления — это её собственный клик
      if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
      const actions: Record<string, () => void> = {
        " ": togglePlay,
        k: togglePlay,
        ArrowLeft: () => seek(time - 5),
        ArrowRight: () => seek(time + 5),
        m: toggleMute,
        f: toggleFullscreen,
        n: () => nextClaim && seek(nextClaim.range.start),
      };
      const action = actions[e.key] ?? actions[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      action();
      wake();
    };

    // ---------- мини-плеер ----------

    // мини-плеер закрыли крестиком — видео на паузе, окошко спрятано до возврата к разбору
    const [miniClosed, setMiniClosed] = useState(false);
    const closeMini = () => {
      playerRef.current?.pauseVideo();
      setMiniClosed(true);
    };

    // Перетягивание мини-плеера в любое удобное место экрана
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // При изменении размера окна держим перетащенный мини-плеер в видимой области
    useEffect(() => {
      if (!mini || !position) return;
      const handleResize = () => {
        const frame = frameRef.current;
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        const padding = 12;
        const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
        const maxY = Math.max(padding, window.innerHeight - rect.height - padding);
        setPosition((prev) => {
          if (!prev) return null;
          return {
            x: Math.min(Math.max(padding, prev.x), maxX),
            y: Math.min(Math.max(padding, prev.y), maxY),
          };
        });
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [mini, Boolean(position)]);

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!mini) return;
      if (e.button !== 0) return;
      // Не начинать перетягивание при клике по интерактивным кнопкам
      if ((e.target as HTMLElement).closest("button, a, input, [role='button']")) return;

      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();

      const startX = position ? position.x : rect.left;
      const startY = position ? position.y : rect.top;
      const startClientX = e.clientX;
      const startClientY = e.clientY;

      let hasMoved = false;

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startClientX;
        const dy = ev.clientY - startClientY;

        if (!hasMoved && Math.hypot(dx, dy) > 4) {
          hasMoved = true;
          setIsDragging(true);
        }

        if (hasMoved) {
          const padding = 12;
          const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
          const maxY = Math.max(padding, window.innerHeight - rect.height - padding);
          const nextX = Math.min(Math.max(padding, startX + dx), maxX);
          const nextY = Math.min(Math.max(padding, startY + dy), maxY);
          setPosition({ x: nextX, y: nextY });
        }
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        if (hasMoved) {
          setTimeout(() => {
            setIsDragging(false);
          }, 60);
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    // FLIP: рамка плеера летит из колонки в угол и обратно. Где она была — запоминаем после каждого
    // рендера; при смене режима считаем сдвиг и масштаб до нового места и анимируем transform к нулю.
    const lastRect = useRef<DOMRect | null>(null);
    const wasMini = useRef(mini);
    useLayoutEffect(() => {
      if (wasMini.current === mini) return;
      wasMini.current = mini;
      if (!mini) setMiniClosed(false);
      if (mini && document.fullscreenElement) void document.exitFullscreen();
      const el = frameRef.current;
      const first = lastRect.current;
      if (!el || !first || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const last = el.getBoundingClientRect();
      if (!last.width || !last.height) return;
      el.animate(
        [
          {
            transformOrigin: "top left",
            transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${
              first.width / last.width
            }, ${first.height / last.height})`,
          },
          { transformOrigin: "top left", transform: "none" },
        ],
        { duration: MORPH_MS, easing: MORPH_EASE },
      );
    }, [mini]);
    // объявлен после FLIP: тот успевает прочитать прошлое положение до обновления
    useLayoutEffect(() => {
      lastRect.current = frameRef.current?.getBoundingClientRect() ?? null;
    });

    // ---------- полоса ----------

    const total = Math.max(duration, ...factChecks.map((fc) => fc.range.end), 1);
    const percent = (sec: number) => `${Math.min(100, Math.max(0, (sec / total) * 100))}%`;
    const trackRef = useRef<HTMLDivElement>(null);
    const [scrub, setScrub] = useState<number | null>(null);
    const [hoverSec, setHoverSec] = useState<number | null>(null);
    const [hoverClaim, setHoverClaim] = useState<FactCheck | null>(null);

    const secAt = (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * total;
    };

    const shownTime = scrub ?? time;
    const current = factChecks.find((fc) => fc.id === currentClaimId);
    const isPlaying = state === "playing" || state === "buffering";
    const showControls = !isPlaying || active || menuOpen || scrub !== null;

    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

    return (
      // в мини-режиме колонки нет: рамка плеера уходит в угол (fixed), секция не занимает места
      <section className={mini ? "contents" : "flex min-h-0 w-full flex-1 flex-col gap-4"}>
        {/* ---------- плеер ---------- */}
        <div
          ref={frameRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onMouseMove={wake}
          onMouseLeave={() => setActive(false)}
          onPointerDown={mini ? handlePointerDown : undefined}
          style={
            mini && position
              ? {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  bottom: "auto",
                  right: "auto",
                }
              : undefined
          }
          className={`group/player relative flex select-none items-center justify-center overflow-hidden bg-[#1E1515] outline-none [container-type:size] ${
            mini
              ? `!fixed z-50 aspect-video w-[min(360px,calc(100vw-2.5rem))] rounded-[18px] shadow-[0px_18px_50px_rgba(30,21,21,0.38)] touch-none select-none ${
                  isDragging
                    ? "cursor-grabbing transition-none"
                    : "cursor-grab transition-[opacity,scale] duration-[350ms]"
                } ${!position ? "bottom-5 left-5" : ""} ${
                  miniClosed ? "pointer-events-none scale-95 opacity-0" : ""
                }`
              : fullscreen
                ? "h-full w-full"
                : "aspect-video w-full rounded-[24px] lg:aspect-auto lg:min-h-[260px] lg:flex-1"
          } ${showControls || mini ? "" : "cursor-none"}`}
        >
          {/* Видео вписано в 16:9 внутри плеера. Как у Vidstack: iframe в 10 раз выше рамки и отцентрован —
              YouTube вписывает видео по ширине, и оно остаётся на месте, а шапка с названием и каналом и полоса
              «Ещё видео» уезжают далеко за края и обрезаются. Мышь забирает наш слой сверху. */}
          <div className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] shrink-0 overflow-hidden">
            <div
              ref={hostRef}
              className="pointer-events-none absolute inset-0 flex items-center [&>iframe]:h-[1000%] [&>iframe]:w-full [&>iframe]:shrink-0"
            />
            {/* до старта и в конце — своя обложка: у YouTube там красная кнопка и экран рекомендаций */}
            {(!started || state === "ended") && (
              <Poster videoId={videoId} thumbnailUrl={video.thumbnailUrl} dimmed={state === "ended"} />
            )}
          </div>
          <div
            className="absolute inset-0"
            onClick={() => {
              if (isDragging) return;
              if (menuOpen) setMenuOpen(false);
              else togglePlay();
            }}
            onDoubleClick={
              mini
                ? () => {
                    if (!isDragging) onExpand?.();
                  }
                : toggleFullscreen
            }
          />

          {mini && (
            <MiniOverlay
              isPlaying={isPlaying}
              progress={percent(time)}
              current={current}
              onTogglePlay={togglePlay}
              onExpand={onExpand}
              onClose={closeMini}
              isDragging={isDragging}
            />
          )}

          {/* затемнение под надписями сверху и снизу */}
          {!mini && (
            <div
              className={`pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(30,21,21,0.45)_0%,transparent_22%,transparent_55%,rgba(30,21,21,0.75)_100%)] transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* сверху: сколько проверено, качество */}
          {!mini && (
            <div
              className={`pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className="flex items-center gap-2 rounded-full bg-[#1E1515]/70 px-3.5 py-2 text-[13px] font-extrabold text-white backdrop-blur-sm">
                <CircleCheck className="h-4 w-4 text-[#3DDC97]" />
                {/* пока анализ идёт, утверждения приходят по одному — считаем только уже проверенные */}
                Проверено {checkedCount} {plural(checkedCount, ["утверждение", "утверждения", "утверждений"])}
              </span>
              <div className="flex items-center gap-2 pointer-events-auto">
                {video.pageUrl && (
                  <a
                    href={video.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Перейти к видео"
                    className="flex items-center gap-1.5 rounded-full bg-[#1E1515]/70 px-3 py-2 text-[12px] font-extrabold text-white backdrop-blur-sm transition-all hover:bg-[#1E1515]/90 hover:scale-105 no-underline"
                  >
                    <img src="/blob.png" alt="" className="h-4 w-4 shrink-0 rounded-full select-none" />
                    <span>Ссылка</span>
                  </a>
                )}
                {quality && (
                  <span className="rounded-full bg-[#1E1515]/70 px-3 py-2 text-[12px] font-extrabold text-white backdrop-blur-sm">
                    {quality}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* центр: большая кнопка, пока видео стоит; загрузка (в мини — свои кнопки) */}
          {mini
            ? null
            : state === "buffering" || !ready
              ? !loadError && (
                  // центрирует обёртка: animate-spin перезаписывает transform и съел бы translate
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  </span>
                )
              : !isPlaying && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={state === "ended" ? "Смотреть сначала" : "Смотреть"}
                    className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-[#FBF8F7] text-[#4A3333] shadow-[0px_10px_30px_rgba(30,21,21,0.35)] transition-transform hover:scale-105 active:scale-95"
                  >
                    {state === "ended" ? (
                      <RotateCcw className="h-7 w-7" strokeWidth={2.4} />
                    ) : (
                      <Play className="ml-1 h-7 w-7" strokeWidth={2.4} />
                    )}
                  </button>
                )}

          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm font-semibold text-white/80">
              {loadError}
              <a
                href={video.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-[#4A3333] no-underline"
              >
                Открыть на YouTube
              </a>
            </div>
          )}

          {/* Текущее утверждение — видно всегда, и во весь экран тоже: пока управление спрятано, плашка
              опускается к низу и сжимается, чтобы не мешать смотреть. Клик: во весь экран — карточка
              подробностей поверх видео, иначе — смотреть утверждение с начала (подробности — в ленте справа) */}
          {current && !mini && (
            <button
              key={current.id}
              type="button"
              onClick={() => (fullscreen ? setDetailsOpen((v) => !v) : seek(current.range.start))}
              title={fullscreen ? "Подробнее об утверждении" : "Смотреть утверждение с начала"}
              className={`absolute left-4 z-10 flex min-w-0 animate-[claim-chip-in_320ms_ease-out] cursor-pointer items-center gap-2.5 rounded-full border-none py-1.5 pl-1.5 pr-3.5 text-left shadow-[0px_6px_18px_rgba(30,21,21,0.25)] backdrop-blur-md transition-all duration-300 hover:bg-[#FBF8F7] sm:left-5 ${
                showControls
                  ? "bottom-[84px] max-w-[min(640px,calc(100%-2rem))] bg-[#FBF8F7]"
                  : "bottom-4 max-w-[min(440px,calc(100%-2rem))] bg-[#FBF8F7]/85"
              } ${detailsOpen ? "ring-2 ring-[#FBF8F7]" : ""}`}
            >
              <span className="shrink-0 whitespace-nowrap">
                <StatusPill factCheck={current} />
              </span>
              <span className="min-w-0 truncate text-[14px] font-extrabold text-[#4A3333]">
                {cleanQuote(current.quote)}
              </span>
              {fullscreen ? (
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#A27C7A]" />
              ) : (
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#A27C7A]">
                  {formatTimecode(current.range.start)}
                </span>
              )}
            </button>
          )}

          {fullscreen && detailsOpen && current && (
            <ClaimOverlayCard
              factCheck={current}
              compact={!showControls}
              onClose={() => setDetailsOpen(false)}
              onSeek={() => seek(current.range.start)}
              onOpenTree={
                onOpenTree && hasProvenanceTree(current.provenance)
                  ? () => {
                      // дерево — отдельный экран: сначала выходим из полноэкранного
                      void document.exitFullscreen?.();
                      onOpenTree(current.id);
                    }
                  : undefined
              }
            />
          )}

          {/* снизу: текущее утверждение, полоса, управление */}
          <div
            className={`absolute inset-x-0 bottom-0 px-4 pb-3 transition-opacity duration-300 sm:px-5 ${
              mini ? "hidden" : showControls ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* полоса: пройденное, метки утверждений, бегунок; тянется мышью */}
            <div
              ref={trackRef}
              role="slider"
              aria-label="Перемотка"
              aria-valuemin={0}
              aria-valuemax={Math.round(total)}
              aria-valuenow={Math.round(shownTime)}
              className="relative h-5 cursor-pointer touch-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setScrub(secAt(e.clientX));
              }}
              onPointerMove={(e) => {
                setHoverSec(secAt(e.clientX));
                if (scrub !== null) setScrub(secAt(e.clientX));
              }}
              onPointerUp={(e) => {
                if (scrub === null) return;
                seek(secAt(e.clientX));
                setScrub(null);
              }}
              onPointerLeave={() => {
                setHoverSec(null);
                setHoverClaim(null);
              }}
            >
              <span className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-white/35" />
              <span
                className="absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-white"
                style={{ width: percent(shownTime) }}
              />
              {factChecks.map((fc) => (
                <button
                  key={fc.id}
                  type="button"
                  aria-label={`${formatTimecode(fc.range.start)} · ${cleanQuote(fc.quote)}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    seek(fc.range.start);
                  }}
                  onPointerEnter={() => setHoverClaim(fc)}
                  onPointerLeave={() => setHoverClaim(null)}
                  className={`absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white p-0 transition-transform hover:scale-150 ${
                    fc.id === currentClaimId ? "scale-125" : ""
                  }`}
                  style={{ left: percent(fc.range.start), backgroundColor: claimColor(fc) }}
                />
              ))}
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0px_2px_6px_rgba(30,21,21,0.4)]"
                style={{ left: percent(shownTime) }}
              />

              {/* подсказка над полосой: цитата утверждения под мышью или время */}
              {(hoverClaim || hoverSec !== null) && (
                <span
                  className="pointer-events-none absolute bottom-6 z-30 max-w-[280px] -translate-x-1/2 rounded-xl bg-[#1E1515]/90 px-2.5 py-1.5 text-[12px] font-bold text-white"
                  style={{ left: percent(hoverClaim ? hoverClaim.range.start : (hoverSec ?? 0)) }}
                >
                  {hoverClaim ? (
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-white/70">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: claimColor(hoverClaim) }}
                        />
                        {formatTimecode(hoverClaim.range.start)} · {claimLabel(hoverClaim)}
                      </span>
                      <span className="line-clamp-2 w-max max-w-[260px]">
                        «{cleanQuote(hoverClaim.quote)}»
                      </span>
                    </span>
                  ) : (
                    <span className="tabular-nums">{formatTimecode(hoverSec ?? 0)}</span>
                  )}
                </span>
              )}
            </div>

            {/* управление */}
            <div className="mt-1.5 flex items-center gap-1 text-white">
              <CtrlButton label={isPlaying ? "Пауза (K)" : "Смотреть (K)"} onClick={togglePlay}>
                {isPlaying ? (
                  <Pause className="h-[22px] w-[22px] fill-current" />
                ) : (
                  <Play className="h-[22px] w-[22px] fill-current" />
                )}
              </CtrlButton>
              <CtrlButton
                label="К следующему утверждению (N)"
                onClick={() => nextClaim && seek(nextClaim.range.start)}
                disabled={!nextClaim}
              >
                <SkipForward className="h-[22px] w-[22px]" />
              </CtrlButton>

              <div className="group/vol flex items-center">
                <CtrlButton label={muted ? "Включить звук (M)" : "Выключить звук (M)"} onClick={toggleMute}>
                  <VolumeIcon className="h-[22px] w-[22px]" />
                </CtrlButton>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  aria-label="Громкость"
                  className="h-1 w-0 cursor-pointer accent-white opacity-0 transition-all duration-200 focus:mr-2 focus:w-20 focus:opacity-100 group-hover/vol:mr-2 group-hover/vol:w-20 group-hover/vol:opacity-100"
                />
              </div>

              <span className="ml-1.5 whitespace-nowrap text-[13px] font-extrabold tabular-nums">
                {formatTimecode(shownTime)} <span className="text-white/60">/ {formatTimecode(total)}</span>
              </span>

              <span className="ml-auto flex items-center gap-1">
                <CtrlButton label={captions ? "Выключить субтитры" : "Субтитры"} onClick={toggleCaptions}>
                  <Captions className={`h-[22px] w-[22px] ${captions ? "" : "opacity-70"}`} />
                  {captions && (
                    <span className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-[#E2353F]" />
                  )}
                </CtrlButton>

                <div className="relative">
                  <CtrlButton label="Скорость" onClick={() => setMenuOpen((v) => !v)}>
                    <Settings
                      className={`h-[22px] w-[22px] transition-transform duration-300 ${menuOpen ? "rotate-45" : ""}`}
                    />
                  </CtrlButton>
                  {menuOpen && (
                    <div className="absolute bottom-11 right-0 z-40 min-w-[150px] rounded-2xl bg-[#1E1515]/95 p-1.5 shadow-xl backdrop-blur-sm">
                      <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/50">
                        Скорость
                      </div>
                      {RATES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => changeRate(r)}
                          className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border-none bg-transparent px-2.5 py-1.5 text-left text-[13px] font-bold text-white hover:bg-white/10"
                        >
                          {r === 1 ? "Обычная" : `${r}×`}
                          {r === rate && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <CtrlButton
                  label={fullscreen ? "Выйти из полноэкранного (F)" : "Во весь экран (F)"}
                  onClick={toggleFullscreen}
                >
                  {fullscreen ? (
                    <Minimize className="h-[22px] w-[22px]" />
                  ) : (
                    <Maximize className="h-[22px] w-[22px]" />
                  )}
                </CtrlButton>
              </span>
            </div>
          </div>
        </div>

        {/* ---------- название и действия ---------- */}
        <div className={mini ? "hidden" : "flex shrink-0 flex-col gap-3 px-1"}>
          <h1 className="m-0 line-clamp-2 text-xl font-black leading-tight text-[#4A3333] sm:text-[26px]">
            {video.title || "Видео YouTube"}
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 text-[13px] font-bold text-[#A27C7A]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2353F] text-white">
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[14px] font-extrabold text-[#4A3333]">YouTube</span>
                <span>
                  {[formatTimecode(total), publishedLabel(video.publishedAt)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              <ShareButton />
              <a
                href={video.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full bg-[#FBF8F7] px-4 py-2.5 text-[13px] font-extrabold text-[#4A3333] no-underline [box-shadow:0px_2px_8px_rgba(74,51,51,0.06)] transition-colors hover:bg-white"
              >
                <img src="/blob.png" alt="" className="h-4 w-4 shrink-0 rounded-full select-none" />
                Открыть оригинал
              </a>
            </span>
          </div>
        </div>
      </section>
    );
  },
);

/**
 * Управление мини-плеера: при наведении — пауза по центру, «развернуть» и «закрыть» сверху, текущее
 * утверждение; тонкая полоса прогресса видна всегда.
 */
function MiniOverlay({
  isPlaying,
  progress,
  current,
  onTogglePlay,
  onExpand,
  onClose,
  isDragging,
}: {
  isPlaying: boolean;
  progress: string;
  current: FactCheck | undefined;
  onTogglePlay: () => void;
  onExpand?: () => void;
  onClose: () => void;
  isDragging?: boolean;
}) {
  const hover =
    "opacity-0 transition-opacity duration-200 group-hover/player:opacity-100 group-focus-within/player:opacity-100";
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(30,21,21,0.55)_0%,transparent_40%,transparent_60%,rgba(30,21,21,0.6)_100%)] ${hover}`}
      />
      {/* Ручка/подсказка перетягивания */}
      <div
        className={`pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-[#1E1515]/75 px-2.5 py-1 text-[11px] font-extrabold text-white/90 backdrop-blur-sm select-none ${
          isDragging ? "opacity-100" : hover
        }`}
      >
        <GripHorizontal className="h-3.5 w-3.5 text-white/70" />
        <span>Перетянуть</span>
      </div>
      <div className={`absolute right-2 top-2 flex gap-1 ${hover}`}>
        {onExpand && (
          <MiniButton label="Развернуть — к разбору" onClick={onExpand}>
            <Maximize2 className="h-4 w-4" />
          </MiniButton>
        )}
        <MiniButton label="Закрыть" onClick={onClose}>
          <X className="h-4 w-4" />
        </MiniButton>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        aria-label={isPlaying ? "Пауза" : "Смотреть"}
        className={`absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-[#FBF8F7]/95 text-[#4A3333] shadow-lg ${
          isPlaying ? hover : ""
        }`}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        )}
      </button>
      {current && (
        <span
          className={`pointer-events-none absolute bottom-3 left-2.5 right-2.5 truncate text-[12px] font-extrabold text-white ${hover}`}
        >
          {formatTimecode(current.range.start)} · {cleanQuote(current.quote)}
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
        <span className="block h-full bg-white" style={{ width: progress }} />
      </span>
    </>
  );
}

function MiniButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[#1E1515]/70 text-white backdrop-blur-sm transition-colors hover:bg-[#1E1515]"
    >
      {children}
    </button>
  );
}

/** Обложка видео: превью YouTube в максимальном качестве, если его нет — в обычном */
function Poster({
  videoId,
  thumbnailUrl,
  dimmed,
}: {
  videoId: string;
  thumbnailUrl?: string;
  dimmed: boolean;
}) {
  const fallback = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const [src, setSrc] = useState(thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => src !== fallback && setSrc(fallback)}
      // нет превью в высоком качестве — YouTube отдаёт серую заглушку 120×90
      onLoad={(e) => e.currentTarget.naturalWidth <= 120 && src !== fallback && setSrc(fallback)}
      className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ${
        dimmed ? "brightness-[0.45]" : ""
      }`}
    />
  );
}

function CtrlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-white transition-colors hover:bg-white/15 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** «Поделиться отчётом»: копирует ссылку на эту проверку */
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // буфер обмена недоступен (http без localhost) — ничего не делаем
    }
  };
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-[#FBF8F7] px-4 py-2.5 text-[13px] font-extrabold text-[#4A3333] [box-shadow:0px_2px_8px_rgba(74,51,51,0.06)] transition-colors hover:bg-white"
    >
      {copied ? <Check className="h-4 w-4 text-[#1DA57A]" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Ссылка скопирована" : "Поделиться отчётом"}
    </button>
  );
}

/** "2026-08-02T…" → «2 авг. 2026 г.» */
function publishedLabel(iso: string | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t)
    ? ""
    : new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

/** Сколько источников показывать в карточке во весь экран */
const OVERLAY_SOURCES = 4;

const STANCE_DOT: Record<FactCheck["sources"][number]["stance"], string> = {
  supports: "#1DA57A",
  refutes: "#E2353F",
  mixed: "#E0A800",
  neutral: "#C9B8B6",
};

/**
 * Во весь экран — подробности текущего утверждения поверх видео, справа: позиция источников, флаги,
 * несколько источников со ссылками, дерево. Видео идёт дальше; карточка следует за текущим утверждением.
 */
function ClaimOverlayCard({
  factCheck: fc,
  compact,
  onClose,
  onSeek,
  onOpenTree,
}: {
  factCheck: FactCheck;
  /** Управление спрятано — карточка может занять высоту до низа */
  compact: boolean;
  onClose: () => void;
  onSeek: () => void;
  onOpenTree?: () => void;
}) {
  const summary = summaryLine(fc);
  const sources = fc.sources.slice(0, OVERLAY_SOURCES);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`absolute right-5 top-5 z-30 flex w-[min(380px,calc(100%-2.5rem))] animate-[claim-chip-in_220ms_ease-out] flex-col gap-2.5 overflow-y-auto rounded-[22px] bg-[#FBF8F7]/95 p-4 text-[#4A3333] shadow-[0px_12px_40px_rgba(30,21,21,0.35)] backdrop-blur-md ${
        compact ? "max-h-[calc(100%-5rem)]" : "max-h-[calc(100%-9.5rem)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSeek}
          title="Смотреть утверждение с начала"
          className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-extrabold tabular-nums text-[#A27C7A] hover:text-[#1660D6]"
        >
          {formatTimecode(fc.range.start)}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-[#F1EBE9] text-[#4A3333] hover:bg-[#E3D9D6]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="m-0 text-[16px] font-extrabold leading-snug">{cleanQuote(fc.quote)}</p>
      <StatusPill factCheck={fc} />
      {summary && <p className="m-0 text-[13px] font-semibold leading-snug text-[#A27C7A]">{summary}</p>}
      <FlagList factCheck={fc} />
      {sources.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-2xl bg-[#F1EBE9] p-2.5">
          {sources.map((src) => (
            <li key={src.id}>
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[13px] font-bold text-[#4A3333] no-underline hover:underline"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STANCE_DOT[src.stance] }}
                />
                <span className="truncate">{src.publisher}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#A27C7A]" />
              </a>
            </li>
          ))}
          {fc.sources.length > OVERLAY_SOURCES && (
            <li className="pl-4 text-[12px] font-semibold text-[#A27C7A]">
              и ещё {fc.sources.length - OVERLAY_SOURCES} — в разборе
            </li>
          )}
        </ul>
      )}
      {onOpenTree && (
        <button
          type="button"
          onClick={onOpenTree}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-full border-none bg-[#4A3333] px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-[#362424]"
        >
          <GitFork className="h-4 w-4" />
          Откуда пошло — дерево источников
        </button>
      )}
    </div>
  );
}
