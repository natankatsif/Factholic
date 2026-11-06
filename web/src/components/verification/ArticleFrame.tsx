"use client";

/**
 * Статья по ссылке: копия страницы во встроенном окне, утверждения обведены цветом позиции источников.
 * Клик по утверждению выбирает его: справа открывается разбор и предложение показать дерево.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FactCheck, JobId } from "@news/contracts";
import { useSiteText } from "../../i18n/site";
import { BACKEND_URL } from "../../lib/jobs";
import { claimColors, cleanQuote } from "./ClaimTextPanel";

/** Страница молчит так долго: показываем обычный текст */
const READY_TIMEOUT_MS = 20_000;

export function ArticleFrame({
  jobId,
  pageUrl,
  factChecks,
  selectedClaimId,
  onSelectClaimId,
  onFailed,
  onFound,
}: {
  jobId: JobId;
  pageUrl: string;
  factChecks: FactCheck[];
  selectedClaimId: string;
  onSelectClaimId: (id: string) => void;
  onFailed: () => void;
  /** Какие утверждения нашлись на странице */
  onFound: (ids: string[]) => void;
}) {
  const t = useSiteText();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [html, setHtml] = useState<string>();
  // клик в самой статье: она уже на месте, прокручивать не надо
  const pickedInFrame = useRef<string>();

  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;
  const onSelectRef = useRef(onSelectClaimId);
  onSelectRef.current = onSelectClaimId;
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; id?: string; ids?: string[] } | null;
      if (data?.type === "fh:ready") setReady(true);
      if (data?.type === "fh:failed") onFailedRef.current();
      if (data?.type === "fh:found" && data.ids) onFoundRef.current(data.ids);
      if (data?.type === "fh:select" && data.id) {
        pickedInFrame.current = data.id;
        onSelectRef.current(data.id);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // страницу вставляем сами: окно с адресом другого порта браузеры и блокировщики могут не пустить
  useEffect(() => {
    let current = true;
    fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}/page`)
      .then((res) => res.text())
      .then((text) => {
        if (current) setHtml(text);
      })
      .catch(() => {
        if (current) onFailedRef.current();
      });
    return () => {
      current = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => onFailedRef.current(), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  const claims = useMemo(
    () => factChecks.map((fc) => ({ id: fc.id, quote: cleanQuote(fc.quote), ...claimColors(fc) })),
    [factChecks],
  );
  const shownSelection = useRef<string>();
  useEffect(() => {
    if (!ready) return;
    const changed = shownSelection.current !== selectedClaimId;
    const scroll = changed && pickedInFrame.current !== selectedClaimId;
    shownSelection.current = selectedClaimId;
    pickedInFrame.current = undefined;
    // страница в песочнице без своего адреса, поэтому получатель "*"
    frame.current?.contentWindow?.postMessage(
      { type: "fh:claims", claims, selected: selectedClaimId, scroll },
      "*",
    );
  }, [ready, claims, selectedClaimId]);

  return (
    <section className="relative flex min-h-[420px] w-full flex-1 flex-col overflow-hidden rounded-[28px] bg-[#FBF8F7]">
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-black uppercase tracking-[-0.2px] text-[#4A3333]">{t.text.article}</h2>
          <p className="m-0 text-[13px] font-bold text-[#A27C7A]">
            {ready ? t.text.articleHint : t.text.articleLoading}
          </p>
        </div>
        <a
          href={pageUrl}
          target="_blank"
          rel="noreferrer"
          title={t.common.openOriginal}
          className="shrink-0 rounded-full bg-[#F1EBE9] px-3.5 py-1.5 text-xs font-extrabold text-[#4A3333]"
        >
          {t.text.original}
        </a>
      </div>
      <iframe
        ref={frame}
        title={t.text.article}
        srcDoc={html}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </section>
  );
}

/** Утверждения, которых нет на странице: выбрать их можно только в правой панели */
export function UnmatchedClaims({
  claims,
  selectedClaimId,
  onSelectClaimId,
}: {
  claims: FactCheck[];
  selectedClaimId: string;
  onSelectClaimId: (id: string) => void;
}) {
  const t = useSiteText();
  return (
    <div className="flex shrink-0 flex-col gap-1.5 px-6 pt-3">
      <span className="text-[13px] font-bold text-[#A27C7A]">{t.text.articleUnmatched(claims.length)}</span>
      <div className="flex flex-wrap gap-1.5">
        {claims.map((fc) => (
          <button
            key={fc.id}
            type="button"
            title={cleanQuote(fc.quote)}
            onClick={() => onSelectClaimId(fc.id)}
            className={`max-w-full cursor-pointer truncate rounded-full px-3 py-1 text-[13px] font-extrabold ${
              fc.id === selectedClaimId ? "bg-[#4A3333] text-white" : "bg-[#F1EBE9] text-[#4A3333]"
            }`}
          >
            {cleanQuote(fc.quote)}
          </button>
        ))}
      </div>
    </div>
  );
}
