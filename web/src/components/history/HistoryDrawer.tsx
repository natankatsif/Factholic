"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  ExternalLink,
  History,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { clearJobs, deleteJob, listJobs, type JobRecord } from "../../lib/jobs";
import { detectPlatform, formatTimeAgo } from "../../lib/platform-detector";

export interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentJobId?: string;
}

export function HistoryDrawer({ isOpen, onClose, currentJobId }: HistoryDrawerProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRecord[]>([]);

  const reloadJobs = () => {
    setJobs(listJobs());
  };

  useEffect(() => {
    if (isOpen) {
      reloadJobs();
      // Block body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectJob = (jobId: string) => {
    onClose();
    if (jobId !== currentJobId) {
      router.push(`/check/${jobId}`);
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    deleteJob(jobId);
    reloadJobs();
  };

  const handleClearAll = () => {
    if (window.confirm("Очистить всю историю проверок?")) {
      clearJobs();
      reloadJobs();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#4A3333]/25 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer Panel */}
      <div className="relative z-10 flex h-full w-full max-w-[480px] flex-col border-l border-[#E2D7D4] bg-[#FBF8F7] text-[#4A3333] shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="box-border flex shrink-0 items-center justify-between border-b border-[#EADFDc] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1EBE9] text-[#4A3333]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-[-0.5px]">История проверок</h3>
                {jobs.length > 0 && (
                  <span className="rounded-full bg-[#F1EBE9] px-2.5 py-0.5 text-xs font-black text-[#A27C7A]">
                    {jobs.length}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-[#A27C7A]">
                Сохранённые разборы в этом браузере
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {jobs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                title="Очистить историю"
                className="cursor-pointer rounded-full border-none bg-transparent p-2 text-xs font-bold text-[#A27C7A] hover:bg-[#F1EBE9] hover:text-[#E2353F] transition-colors"
              >
                Очистить
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-[#F1EBE9] text-[#4A3333] hover:bg-[#E3D9D6] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {jobs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EBE9] text-[#A27C7A]">
                <Clock className="h-8 w-8" />
              </div>
              <h4 className="text-base font-black">История пуста</h4>
              <p className="max-w-[280px] text-xs font-semibold text-[#A27C7A]">
                Здесь будут появляться проверенные вами ссылки на видео, посты из соцсетей или тексты.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/");
                }}
                className="mt-3 cursor-pointer rounded-full bg-[#4A3333] px-5 py-2.5 text-xs font-black text-white hover:bg-[#362424] transition-colors"
              >
                Начать проверку
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => {
                const isCurrent = job.jobId === currentJobId;
                const platform = detectPlatform(job.input, job.isUrl, job.report?.video);
                const claimsCount = job.report?.factChecks?.length ?? 0;
                const timeAgo = formatTimeAgo(job.createdAt);

                // Title: use video title if non-empty, otherwise job input snippet
                const displayTitle =
                  job.report?.video?.title && !job.report.video.title.startsWith("http")
                    ? job.report.video.title
                    : job.input;

                return (
                  <div
                    key={job.jobId}
                    onClick={() => handleSelectJob(job.jobId)}
                    className={`group relative flex cursor-pointer flex-col gap-2 rounded-[20px] p-4 transition-all duration-150 ${
                      isCurrent
                        ? "bg-white shadow-[0px_4px_16px_rgba(74,51,51,0.08)] ring-2 ring-[#4A3333]"
                        : "bg-[#FBF8F7] border border-[#E8DDD9] hover:bg-white hover:shadow-md"
                    }`}
                  >
                    {/* Top row: Platform Badge + Timestamp + Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Platform Badge */}
                        <div
                          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black"
                          style={{
                            backgroundColor: platform.badgeBg,
                            color: platform.badgeFg,
                            border: `1px solid ${platform.badgeBorder}`,
                          }}
                        >
                          {platform.renderIcon("h-3.5 w-3.5 shrink-0")}
                          <span className="truncate max-w-[120px]">{platform.label}</span>
                        </div>

                        {isCurrent && (
                          <span className="rounded-full bg-[#1DA57A] px-2 py-0.5 text-[10px] font-extrabold text-white">
                            Текущая
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-[#A27C7A] whitespace-nowrap">
                          {timeAgo}
                        </span>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, job.jobId)}
                          title="Удалить из истории"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[#A27C7A] opacity-0 transition-opacity hover:bg-[#FDE3E5] hover:text-[#E2353F] group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Material Title / Excerpt */}
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-[#4A3333]">
                      {displayTitle}
                    </p>

                    {/* Bottom stats row */}
                    <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[#A27C7A]">
                      {job.report ? (
                        <div className="flex items-center gap-2">
                          {claimsCount > 0 ? (
                            <span className="font-extrabold text-[#4A3333]">
                              {claimsCount} {claimsCount === 1 ? "тезис" : claimsCount < 5 ? "тезиса" : "тезисов"}
                            </span>
                          ) : (
                            <span>Анализ завершён</span>
                          )}

                          {job.report.summary?.consensusBreakdown && (
                            <span className="rounded-md bg-[#F1EBE9] px-1.5 py-0.5 text-[11px] font-bold text-[#4A3333]">
                              {job.report.summary.consensusBreakdown.against > 0
                                ? "Есть опровержения"
                                : job.report.summary.consensusBreakdown.converge > 0
                                  ? "Сходятся"
                                  : "Разделились"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-[#0AA6C2]">
                          <span className="h-2 w-2 rounded-full bg-[#0AA6C2] animate-pulse" />
                          В процессе проверки
                        </span>
                      )}

                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#A27C7A] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[#4A3333]">
                        <span>Открыть</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Start new check */}
        <div className="border-t border-[#EADFDc] p-4 sm:p-5 bg-[#F1EBE9]/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/");
            }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#4A3333] py-3 text-sm font-black text-white hover:bg-[#362424] transition-all active:scale-[0.99] shadow-xs"
          >
            <Sparkles className="h-4 w-4" />
            <span>Новая проверка</span>
          </button>
        </div>
      </div>
    </div>
  );
}
