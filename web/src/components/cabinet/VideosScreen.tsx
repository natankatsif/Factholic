"use client";

/** Раздел «Видео»: отдельно от вопросов, утверждения из видео в общий список не попадают */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Video } from "lucide-react";
import { youtubeVideoId } from "../../lib/youtube";
import { useCabinetActions } from "./actions";
import { CabinetShell } from "./CabinetShell";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import type { CabinetSession, VideoRow } from "./types";

function VideoItem({ row }: { row: VideoRow }) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const text = t.videos;
  const failed = row.status === "failed";
  const facts = [
    row.date,
    row.duration,
    row.claims > 0 && text.claims(row.claims, t.plural(row.claims, text.claimsWord)),
    row.claims > 0 && text.checked(row.checked),
    row.status === "running" && text.running,
    failed && text.failed,
  ].filter(Boolean);
  const body = (
    <>
      <div className="flex aspect-video w-[168px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-border">
        {row.thumbnailUrl ? (
          <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Video className="h-6 w-6 text-cabinet-ink-mid" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-[16px] font-black">{row.title}</span>
        <span className="text-[13px] font-bold text-cabinet-ink-mid">{facts.join(" · ")}</span>
      </div>
    </>
  );
  const box = "flex w-full items-center gap-4 rounded-[20px] bg-card p-3";
  if (!failed) {
    return (
      <Link href={`/cabinet/videos/${row.id}`} className={`${box} hover:shadow-[0_6px_18px_#4A33331F]`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={box}>
      {body}
      <button
        type="button"
        onClick={() => void actions.retryCheck(row.id)}
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-[14px] font-extrabold text-white"
      >
        {text.retry}
      </button>
    </div>
  );
}

export function VideosScreen({
  fixture,
}: {
  fixture?: { session: CabinetSession; videos: VideoRow[] } | Pick<CabinetFixture, "session">;
}) {
  const t = useCabinetText();
  const text = t.videos;
  const actions = useCabinetActions();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string>();
  const rows = fixture && "videos" in fixture ? fixture.videos : [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const url = link.trim();
    if (!url) return;
    if (!youtubeVideoId(url)) return setError(text.notYoutube);
    setError(undefined);
    void actions.startCheck(url);
  };

  return (
    <CabinetShell session={fixture?.session} videos pinnedMenu>
      <main className="flex h-full min-w-0 flex-1 flex-col items-start gap-6 overflow-y-auto overscroll-none px-12 py-8">
        <div className="flex flex-col items-start gap-1">
          <h1 className="whitespace-nowrap text-[36px] font-black [line-height:normal]">{text.title}</h1>
          {rows.length > 0 && (
            <p className="text-[15px] font-bold text-cabinet-ink-mid">
              {text.subtitle(rows.length, t.plural(rows.length, text.word))}
            </p>
          )}
        </div>
        <form onSubmit={submit} className="flex w-full max-w-[720px] flex-col gap-1.5">
          <div className="flex w-full items-center gap-2 rounded-full bg-card p-1.5 pl-5">
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder={text.placeholder}
              aria-label={text.placeholder}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:text-cabinet-ink-mid"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-primary px-5 py-2 text-[14px] font-extrabold text-white"
            >
              {text.submit}
            </button>
          </div>
          {error && <p className="pl-5 text-[13px] font-bold text-cabinet-against-text">{error}</p>}
        </form>
        {rows.length === 0 ? (
          <div className="flex w-full max-w-[720px] flex-col gap-1 rounded-[20px] bg-card p-5">
            <span className="text-[16px] font-black">{text.emptyTitle}</span>
            <span className="text-[14px] font-bold text-cabinet-ink-mid">{text.emptyText}</span>
          </div>
        ) : (
          <div className="flex w-full max-w-[720px] flex-col gap-3">
            {rows.map((row) => (
              <VideoItem key={row.id} row={row} />
            ))}
          </div>
        )}
      </main>
    </CabinetShell>
  );
}
