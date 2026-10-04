import React from "react";
import { FileText, Globe } from "lucide-react";
import type { VideoReport } from "@news/contracts";

export type PlatformType = "youtube" | "shorts" | "tiktok" | "facebook" | "x" | "website" | "text";

export interface PlatformMeta {
  type: PlatformType;
  label: string;
  badgeBg: string;
  badgeFg: string;
  badgeBorder: string;
  renderIcon: (className?: string) => React.ReactNode;
}

export function detectPlatform(
  input: string,
  isUrl?: boolean,
  video?: VideoReport["video"],
): PlatformMeta {
  const urlOrText = (video?.pageUrl || input || "").trim();
  const lower = urlOrText.toLowerCase();

  // If explicitly not URL, or starts with text:
  if (isUrl === false || lower.startsWith("text:") || (!lower.startsWith("http://") && !lower.startsWith("https://") && !lower.includes("youtu.be") && !lower.includes("tiktok.com") && !lower.includes("facebook.com") && !lower.includes("twitter.com") && !lower.includes("x.com"))) {
    return {
      type: "text",
      label: "Текст",
      badgeBg: "#EDE4FD",
      badgeFg: "#6E1EF0",
      badgeBorder: "#D8C7FA",
      renderIcon: (cls = "h-3.5 w-3.5") => <FileText className={cls} />,
    };
  }

  const platformStr = ((video?.platform as string) || "").toLowerCase();

  // YouTube Shorts
  if (lower.includes("youtube.com/shorts/") || lower.includes("/shorts/")) {
    return {
      type: "shorts",
      label: "Shorts",
      badgeBg: "#FDE6F0",
      badgeFg: "#E0368A",
      badgeBorder: "#F9BED7",
      renderIcon: (cls = "h-3.5 w-3.5") => (
        <svg viewBox="0 0 14 14" fill="none" className={cls} aria-hidden>
          <path
            d="M7 1.3125q-1.53125 0-2.84375 0.76563-1.3125 0.76563-2.07813 2.07812-0.76563 1.3125-0.76562 2.84375 0 1.53125 0.76562 2.84375 0.76563 1.3125 2.07813 2.07813 1.3125 0.76563 2.84375 0.76562 1.53125 0 2.84375-0.76562 1.3125-0.76563 2.07813-2.07813 0.76563-1.3125 0.76562-2.84375 0-1.53125-0.76562-2.84375-0.76563-1.3125-2.07813-2.07813-1.3125-0.76563-2.84375-0.76562z m0 10.5q-1.3125 0-2.40625-0.65625-1.09375-0.65625-1.75-1.75-0.65625-1.09375-0.65625-2.40625 0-1.3125 0.65625-2.40625 0.65625-1.09375 1.75-1.75 1.09375-0.65625 2.40625-0.65625 1.3125 0 2.40625 0.65625 1.09375 0.65625 1.75 1.75 0.65625 1.09375 0.65625 2.40625 0 1.3125-0.65625 2.40625-0.65625 1.09375-1.75 1.75-1.09375 0.65625-2.40625 0.65625z m1.96875-5.19531l-2.625-1.75q-0.21875-0.10938-0.4375 0-0.21875 0.10938-0.21875 0.38281l0 3.5q0 0.27344 0.21875 0.38281 0.10938 0.05469 0.21875 0.05469 0.10938 0 0.21875-0.05469l2.625-1.75q0.21875-0.16406 0.21875-0.38281 0-0.21875-0.21875-0.38281z m-2.40625 1.3125l0-1.85938 1.42188 0.92969-1.42188 0.92969z"
            fill="#E0368A"
          />
        </svg>
      ),
    };
  }

  // YouTube
  if (lower.includes("youtube.com") || lower.includes("youtu.be") || platformStr === "youtube") {
    return {
      type: "youtube",
      label: "YouTube",
      badgeBg: "#FDE3E5",
      badgeFg: "#E2353F",
      badgeBorder: "#F8B4B8",
      renderIcon: (cls = "h-3.5 w-3.5") => (
        <svg viewBox="0 0 14 14" fill="none" className={cls} aria-hidden>
          <path
            d="M8.96875 6.61719l-2.625-1.75q-0.21875-0.10938-0.4375 0-0.21875 0.10938-0.21875 0.38281l0 3.5q0 0.27344 0.21875 0.38281 0.10938 0.05469 0.21875 0.05469 0.10938 0 0.21875-0.05469l2.625-1.75q0.21875-0.16406 0.21875-0.38281 0-0.21875-0.21875-0.38281z m-2.40625 1.3125l0-1.85938 1.42188 0.92969-1.42188 0.92969z m6.23438-4.10156q-0.05469-0.32813-0.27344-0.54688-0.21875-0.21875-0.49219-0.38281-1.20313-0.4375-3.11719-0.60156-1.03906-0.10938-1.91406-0.10938-0.875 0-1.91406 0.10938-1.91406 0.16406-3.11719 0.60156-0.27344 0.16406-0.49219 0.38281-0.21875 0.21875-0.27343 0.54688-0.32813 1.20313-0.32813 3.17187 0 1.96875 0.32813 3.17188 0.05469 0.32813 0.27343 0.54687 0.21875 0.21875 0.49219 0.38281 1.14844 0.4375 3.00781 0.60157 1.03906 0.10938 1.96875 0.10937l0.10938 0q0.92969 0 1.96875-0.10937 1.85937-0.16406 3.00781-0.60157 0.27344-0.16406 0.49219-0.38281 0.21875-0.21875 0.27343-0.54687 0.32813-1.20313 0.32813-3.17188 0-1.96875-0.32813-3.17188z m-0.82032 6.125q-0.05469 0.21875-0.27343 0.32812-1.09375 0.38281-2.95313 0.54688-0.98438 0.10938-1.75 0.10937-0.76563 0-1.75-0.10937-1.85938-0.16406-2.95313-0.54688-0.21875-0.10938-0.27343-0.32812-0.27344-1.09375-0.27344-2.95313 0-1.85938 0.27344-2.95313 0.05469-0.21875 0.27343-0.32812 1.03906-0.38281 2.89844-0.54688 0.98438-0.10938 1.80469-0.10937 0.76563 0 1.75 0.10937 1.85938 0.16406 2.95313 0.54688 0.21875 0.10938 0.27343 0.32812 0.27344 1.09375 0.27344 2.95313 0 1.85938-0.27344 2.95313z"
            fill="#E2353F"
          />
        </svg>
      ),
    };
  }

  // TikTok
  if (lower.includes("tiktok.com") || platformStr === "tiktok") {
    return {
      type: "tiktok",
      label: "TikTok",
      badgeBg: "#F1EBE9",
      badgeFg: "#4A3333",
      badgeBorder: "#D8C7C3",
      renderIcon: (cls = "h-3.5 w-3.5") => (
        <svg viewBox="0 0 14 14" fill="none" className={cls} aria-hidden>
          <path
            d="M12.25 4.15625q-1.09375 0-1.85938-0.76563-0.76563-0.76563-0.76562-1.85937 0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672l-2.1875 0q-0.16406 0-0.30078 0.13672-0.13672 0.13672-0.13672 0.30078l0 7q0 0.38281-0.27344 0.71094-0.27344 0.32813-0.65625 0.38281-0.38281 0.05469-0.73828-0.16406-0.35547-0.21875-0.46484-0.60157-0.10938-0.38281 0.05469-0.76562 0.16406-0.38281 0.49218-0.54688 0.27344-0.10938 0.27344-0.38281l0-2.29687q0-0.21875-0.16406-0.32813-0.16406-0.10938-0.32813-0.10937-1.09375 0.21875-1.91406 0.875-0.82031 0.65625-1.23047 1.64062-0.41016 0.98438-0.27344 2.07813 0.13672 1.09375 0.76563 1.9414 0.62891 0.84766 1.58594 1.3125 0.95703 0.46484 2.02343 0.41016 1.06641-0.05469 1.96875-0.62891 0.90234-0.57422 1.42188-1.5039 0.51953-0.92969 0.51953-2.02344l0-1.96875q1.25781 0.65625 2.625 0.65625 0.16406 0 0.30078-0.13672 0.13672-0.13672 0.13672-0.30078l0-2.1875q0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672z"
            fill="#4A3333"
          />
        </svg>
      ),
    };
  }

  // Facebook
  if (lower.includes("facebook.com") || lower.includes("fb.watch") || lower.includes("fb.com") || platformStr === "facebook") {
    return {
      type: "facebook",
      label: "Facebook",
      badgeBg: "#E8F1FD",
      badgeFg: "#1660D6",
      badgeBorder: "#BDD5FB",
      renderIcon: (cls = "h-3.5 w-3.5") => (
        <svg viewBox="0 0 14 14" fill="none" className={cls} aria-hidden>
          <path
            d="M12.6875 7q0-1.53125-0.76563-2.84375-0.76563-1.3125-2.07812-2.07813-1.3125-0.76563-2.84375-0.76562-1.53125 0-2.84375 0.76562-1.3125 0.76563-2.07813 2.07813-0.76563 1.3125-0.76562 2.84375 0 1.53125 0.76562 2.84375 0.76563 1.3125 2.07813 2.07813 1.3125 0.76563 2.84375 0.76562 1.53125 0 2.84375-0.76562 1.3125-0.76563 2.07813-2.07813 0.76563-1.3125 0.76562-2.84375z m-5.25 4.8125l0-3.5 1.3125 0q0.16406 0 0.30078-0.13672 0.13672-0.13672 0.13672-0.30078 0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672l-1.3125 0 0-1.3125q0-0.38281 0.24609-0.62891 0.24609-0.24609 0.62891-0.24609l0.875 0q0.16406 0 0.30078-0.13672 0.13672-0.13672 0.13672-0.30078 0-0.16406-0.13672-0.30078-0.13672-0.13672-0.30078-0.13672l-0.875 0q-0.71094 0-1.23047 0.51953-0.51953 0.51953-0.51953 1.23047l0 1.3125-1.3125 0q-0.16406 0-0.30078 0.13672-0.13672 0.13672-0.13672 0.30078 0 0.16406 0.13672 0.30078 0.13672 0.13672 0.30078 0.13672l1.3125 0 0 3.5"
            fill="#1660D6"
          />
        </svg>
      ),
    };
  }

  // X / Twitter
  if (lower.includes("twitter.com") || lower.includes("x.com") || platformStr === "x") {
    return {
      type: "x",
      label: "X (Twitter)",
      badgeBg: "#F1EBE9",
      badgeFg: "#4A3333",
      badgeBorder: "#D8C7C3",
      renderIcon: (cls = "h-3.5 w-3.5") => (
        <svg viewBox="0 0 14 14" fill="none" className={cls} aria-hidden>
          <path
            d="M13.50781 3.77344q-0.10937-0.27344-0.38281-0.27344l-1.64062 0q-0.32813-0.54688-0.82032-0.875-0.49219-0.32813-1.12109-0.41016-0.62891-0.08203-1.20313 0.10938-0.57422 0.19141-0.95703 0.60156-0.38281 0.41016-0.60156 0.875-0.21875 0.46484-0.21875 1.01172l0 0.32813q-0.98438-0.27344-2.02344-0.875-0.76563-0.4375-1.47656-1.03907-0.49219-0.38281-0.54687-0.49218-0.21875-0.16406-0.46485-0.08204-0.24609 0.08203-0.30078 0.35547-0.32813 1.75 0.05469 3.28125 0.32813 1.20313 1.03906 2.13281 0.54688 0.76563 1.3125 1.3125-0.49219 0.60156-1.3125 1.03907-0.4375 0.27344-0.82031 0.38281-0.16406 0.10938-0.2461 0.30078-0.08203 0.19141 0.05469 0.41016 0.13672 0.21875 0.57422 0.4375 0.76563 0.38281 1.96875 0.38281 1.91406 0 3.55469-0.90234 1.64063-0.90234 2.67969-2.46094 1.03906-1.55859 1.20312-3.41797l1.64063-1.64063q0.16406-0.21875 0.05468-0.49218z"
            fill="#4A3333"
          />
        </svg>
      ),
    };
  }

  // Any other URL / Website
  let host: string;
  try {
    const parsed = new URL(urlOrText.startsWith("http") ? urlOrText : `https://${urlOrText}`);
    host = parsed.hostname.replace(/^www\./, "");
  } catch {
    host = "Веб-сайт";
  }

  return {
    type: "website",
    label: host || "Статья",
    badgeBg: "#E6F7FA",
    badgeFg: "#0AA6C2",
    badgeBorder: "#BDEBF2",
    renderIcon: (cls = "h-3.5 w-3.5") => <Globe className={cls} />,
  };
}

export function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Только что";
    if (diffSec < 3600) {
      const min = Math.floor(diffSec / 60);
      return `${min} мин назад`;
    }

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    if (isToday) return `Сегодня, ${timeStr}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return `Вчера, ${timeStr}`;

    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
