"use client";

/** Разделы «Видео» и «Ссылки»: отдельно от вопросов, утверждения из видео в общий список не попадают */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Link2, Video } from "lucide-react";
import { youtubeVideoId } from "../../lib/youtube";
import { useCabinetActions } from "./actions";
import { articleThumbnailUrl } from "./api";
import { CabinetShell } from "./CabinetShell";
import { ConfirmDialog } from "./Dialogs";
import { useCabinetText } from "./dictionary";
import type { CabinetFixture } from "./fixtures";
import { DotsIcon } from "./icons";
import { POPOVER_PANEL, PopoverItem, usePopover } from "./Popover";
import type { CabinetSession, VideoRow } from "./types";

function ItemMenu({ row, onDelete }: { row: VideoRow; onDelete: () => void }) {
  const t = useCabinetText();
  const text = row.kind === "article" ? t.links : t.videos;
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={text.more}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-canvas"
      >
        <DotsIcon className="h-[22px] w-[22px] text-cabinet-ink-mid" />
      </button>
      {open && (
        <div className={`${POPOVER_PANEL} right-0 top-9 min-w-[150px]`}>
          <PopoverItem
            danger
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {text.delete}
          </PopoverItem>
        </div>
      )}
    </div>
  );
}

function VideoItem({ row, onDelete }: { row: VideoRow; onDelete: () => void }) {
  const t = useCabinetText();
  const actions = useCabinetActions();
  const article = row.kind === "article";
  const text = article ? t.links : t.videos;
  const Placeholder = article ? Link2 : Video;
  const thumbnail = row.thumbnailUrl ?? (article ? articleThumbnailUrl(row.id) : undefined);
  const [noImage, setNoImage] = useState(false);
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
        {thumbnail && !noImage ? (
          <img
            src={thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setNoImage(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Placeholder className="h-6 w-6 text-cabinet-ink-mid" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-[16px] font-black">{row.title}</span>
        <span className="text-[13px] font-bold text-cabinet-ink-mid">{facts.join(" · ")}</span>
      </div>
    </>
  );
  const box = "flex min-w-0 flex-1 items-center gap-4";
  return (
    <div className="flex w-full items-center gap-2 rounded-[20px] bg-card p-3 hover:shadow-[0_6px_18px_#4A33331F]">
      {failed ? (
        <div className={box}>{body}</div>
      ) : (
        <Link href={`/cabinet/${article ? "links" : "videos"}/${row.id}`} className={box}>
          {body}
        </Link>
      )}
      {failed && (
        <button
          type="button"
          onClick={() => void actions.retryCheck(row.id)}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-[14px] font-extrabold text-white"
        >
          {text.retry}
        </button>
      )}
      <ItemMenu row={row} onDelete={onDelete} />
    </div>
  );
}

export function VideosScreen({
  fixture,
  kind = "video",
}: {
  fixture?: { session: CabinetSession; videos: VideoRow[] } | Pick<CabinetFixture, "session">;
  kind?: VideoRow["kind"];
}) {
  const t = useCabinetText();
  const article = kind === "article";
  const text = article ? t.links : t.videos;
  const actions = useCabinetActions();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<VideoRow>();
  const rows = fixture && "videos" in fixture ? fixture.videos : [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const url = link.trim();
    if (!url) return;
    const fits = article ? /^https?:\/\/\S+$/i.test(url) && !youtubeVideoId(url) : youtubeVideoId(url);
    if (!fits) return setError(text.notYoutube);
    setError(undefined);
    void actions.startCheck(url);
  };

  return (
    <CabinetShell session={fixture?.session} videos={!article} links={article} pinnedMenu>
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
              <VideoItem key={row.id} row={row} onDelete={() => setDeleting(row)} />
            ))}
          </div>
        )}
        {deleting && (
          <ConfirmDialog
            title={text.deleteTitle}
            text={text.deleteText(deleting.title)}
            confirm={text.delete}
            cancel={text.cancel}
            onClose={() => setDeleting(undefined)}
            onConfirm={() => {
              setDeleting(undefined);
              void actions.deleteMaterial(deleting.id);
            }}
          />
        )}
      </main>
    </CabinetShell>
  );
}
