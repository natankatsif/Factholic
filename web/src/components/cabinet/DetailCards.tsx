/** Всплывающие карточки над холстом: публикация и связь */
import { quoteLink } from "../../lib/quote-link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "../../lib/utils";
import { useCabinetText } from "./dictionary";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  HashIcon,
  MapPinIcon,
} from "./icons";
import type { Point } from "./layout";
import { STANCE_TONE } from "./TreeNodes";
import type { ChangeKind, PublicationNode, QuoteWord, TreeEdge, TreeNode } from "./types";
import { Avatar, Pill } from "./ui";

const CARD =
  "absolute z-30 flex cursor-auto select-text flex-col rounded-3xl bg-card outline outline-2 -outline-offset-1 outline-border shadow-[0_10px_30px_#4A333333]";
const CAPTION = "w-full min-w-0 break-words text-[12px] font-extrabold text-cabinet-ink-mid";

const MISSING_COLOR = "#A27C7A";
const CHECKED_COLOR = "#4A3333";

const CHANGE_ICON: Record<ChangeKind, { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }> = {
  number: { icon: HashIcon, tone: "bg-cabinet-inflated-soft text-cabinet-inflated-text" },
  place: { icon: MapPinIcon, tone: "bg-cabinet-blue/10 text-cabinet-blue" },
  time: { icon: ClockIcon, tone: "bg-cabinet-old-soft text-cabinet-old" },
};

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-canvas"
    >
      <CloseIcon className="h-[15px] w-[15px]" />
    </button>
  );
}

function SourceLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("flex items-center gap-[5px] font-extrabold", className)}
    >
      {children}
      <ArrowUpRightIcon className="h-[15px] w-[15px]" />
    </a>
  );
}

export function PublicationDetailCard({
  node,
  position,
  onClose,
}: {
  node: PublicationNode;
  position: Point;
  onClose: () => void;
}) {
  const t = useCabinetText();
  const detail = node.detail;
  const dateText = [node.date ?? t.node.noDate, node.dateNote].filter(Boolean).join(". ");
  const change = detail?.change;
  const ChangeIcon = change && (change.kind === "place" ? MapPinIcon : CHANGE_ICON[change.kind].icon);
  return (
    <div
      className={cn(CARD, "w-[276px] items-start gap-3 p-[18px]")}
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={node.outlet} color={node.color} size={26} textClassName="text-[12px]" />
          <span className="text-[17px] font-black">{node.outlet}</span>
        </div>
        <CloseButton onClose={onClose} label={t.publicationCard.close} />
      </div>
      <div className="w-full text-[17px] font-black leading-[21px]">{detail?.headline ?? node.quote}</div>
      <div className="flex w-full items-start gap-1.5">
        <CalendarIcon className="h-[15px] w-[15px] shrink-0 text-cabinet-ink-mid" />
        <div className="flex-1 text-[13px] font-bold leading-[17px] text-cabinet-ink-mid">{dateText}</div>
      </div>
      <div className="flex w-full flex-col gap-1 rounded-[14px] bg-canvas p-3">
        <div className={CAPTION}>{t.publicationCard.quote}</div>
        <div className="w-full text-[14px] font-extrabold leading-[18px]">
          {detail?.url ? (
            <a
              href={quoteLink(detail.url, detail.fullQuote || node.quote)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-2 hover:decoration-primary"
            >
              {detail.fullQuote || node.quote}
            </a>
          ) : (
            (detail?.fullQuote ?? node.quote)
          )}
        </div>
      </div>
      {node.stance && (
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">
            {t.publicationCard.stance}
          </span>
          <Pill className={cn("py-[3px]", STANCE_TONE[node.stance])}>{t.node.stances[node.stance]}</Pill>
        </div>
      )}
      {change && detail && ChangeIcon && (
        <div className="flex w-full flex-col items-start gap-1.5">
          <div className={CAPTION}>{t.publicationCard.changesAfter(detail.parentName)}</div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cabinet-inflated-soft">
              <ChangeIcon className="h-[15px] w-[15px] text-cabinet-inflated-text" />
            </span>
            <div className="min-w-0 flex-1 text-[14px] font-extrabold leading-[18px]">{change.text}</div>
          </div>
        </div>
      )}
      {detail && (
        <div className="flex w-full flex-col items-start gap-1">
          <div className={CAPTION}>{t.publicationCard.parentLink}</div>
          <div className="w-full text-[14px] font-bold leading-[18px]">{detail.parentLink}</div>
        </div>
      )}
      {detail && (
        <SourceLink href={detail.url} className="text-[14px]">
          {t.publicationCard.openSource}
        </SourceLink>
      )}
    </div>
  );
}

function QuoteLines({ lines }: { lines: QuoteWord[][] }) {
  return lines.map((line, index) => (
    <div key={index} className="flex items-center gap-1">
      {line.map((word) =>
        word.changed ? (
          <span
            key={word.text}
            className="whitespace-nowrap rounded-md bg-cabinet-inflated-soft px-[5px] py-px text-[15px] font-black text-cabinet-inflated-text"
          >
            {word.text}
          </span>
        ) : (
          <span key={word.text} className="text-[15px] font-extrabold">
            {word.text}
          </span>
        ),
      )}
    </div>
  ));
}

export function EdgeDetailCard({
  edge,
  from,
  to,
  position,
  onClose,
}: {
  edge: TreeEdge;
  from?: TreeNode;
  to?: TreeNode;
  position: Point;
  onClose: () => void;
}) {
  const t = useCabinetText();
  const detail = edge.detail;
  // конец линии бывает не изданием: проверяемый текст или ненайденный источник
  const endOf = (node?: TreeNode) => {
    if (node?.kind === "publication") return { name: node.outlet, color: node.color };
    if (node?.kind === "missing") return { name: node.name, color: MISSING_COLOR };
    return { name: t.node.checkedText, color: CHECKED_COLOR };
  };
  const source = endOf(from);
  const target = endOf(to);
  if (!detail) return null;
  return (
    <div
      className={cn(CARD, "w-[524px] items-start gap-3 p-[18px]")}
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Avatar name={source.name} color={source.color} size={26} textClassName="text-[12px]" />
          <span className="text-[17px] font-black">{source.name}</span>
          <ArrowRightIcon className="h-[17px] w-[17px] text-cabinet-inflated" />
          <Avatar name={target.name} color={target.color} size={26} textClassName="text-[12px]" />
          <span className="text-[17px] font-black">{target.name}</span>
          <span className="whitespace-nowrap rounded-full bg-cabinet-inflated-soft px-[9px] py-[3px] text-[12px] font-extrabold text-cabinet-inflated-text">
            {
              t.edgeCard[
                edge.kind === "changed" ? "changed" : edge.kind === "probable" ? "probable" : "confirmed"
              ]
            }
          </span>
        </div>
        <CloseButton onClose={onClose} label={t.edgeCard.close} />
      </div>
      <div className="flex w-full items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[14px] bg-canvas p-3">
          <div className={CAPTION}>{t.edgeCard.before(detail.beforeSource)}</div>
          <QuoteLines lines={detail.before} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[14px] bg-canvas p-3">
          <div className={CAPTION}>{t.edgeCard.after(detail.afterSource)}</div>
          <QuoteLines lines={detail.after} />
        </div>
      </div>
      <div className="flex w-full items-start gap-4">
        {detail.changes.length > 0 && (
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <div className="whitespace-nowrap text-[15px] font-black">
              {detail.similarOnly ? t.edgeCard.differences : t.edgeCard.whatChanged}
            </div>
            {detail.changes.map((change) => {
              const { icon: Icon, tone } = CHANGE_ICON[change.kind];
              return (
                <div key={change.text} className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full",
                      tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 text-[13px] font-extrabold">{change.text}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <div className="whitespace-nowrap text-[15px] font-black">
            {detail.similarOnly ? t.edgeCard.whyLinked : t.edgeCard.evidence}
          </div>
          <div className="w-full text-[13px] font-bold leading-[18px]">{detail.evidence}</div>
          {detail.fragmentUrl && (
            <SourceLink href={detail.fragmentUrl} className="text-[13px]">
              {t.edgeCard.openFragment}
            </SourceLink>
          )}
        </div>
      </div>
    </div>
  );
}
