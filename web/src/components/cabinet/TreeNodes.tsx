/** Узлы холста: один вид на все экраны, отличия только в данных и выделении */
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useCabinetText } from "./dictionary";
import { BrokenLinkIcon, CalendarIcon, HistoryIcon, QuestionIcon, QuotesIcon, SearchIcon } from "./icons";
import type {
  AlertGroup,
  CheckedTextNode,
  MissingNode,
  PublicationNode,
  Stance,
  UnlinkedPublication,
} from "./types";
import { Avatar } from "./ui";

export const STANCE_TONE: Record<Stance, string> = {
  for: "bg-cabinet-agree-soft",
  against: "bg-cabinet-against-soft",
  partial: "bg-cabinet-split-soft",
  neutral: "bg-canvas",
};

function NodeTag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate whitespace-nowrap rounded-full px-[9px] py-[3px] text-[12px] font-extrabold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function FloatingLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute -top-[13px] left-3 flex h-[26px] items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 text-[12px] font-extrabold text-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

function nodeOutline(node: PublicationNode, selected: boolean): string {
  if (selected) return "outline-[3px] -outline-offset-[1.5px] outline-primary";
  if (node.role === "root") return "outline-primary";
  if (node.role === "debunk") return "outline-cabinet-old";
  return node.changeLabel ? "outline-cabinet-inflated" : "outline-border";
}

export function PublicationCard({ node, selected }: { node: PublicationNode; selected: boolean }) {
  const t = useCabinetText();
  const official = node.type === "official";
  return (
    <div
      className={cn(
        "relative flex w-[190px] flex-col items-start gap-1.5 rounded-[20px] bg-card p-3.5 outline outline-2 -outline-offset-1",
        nodeOutline(node, selected),
        node.role === "prehistory" && "opacity-65",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <Avatar name={node.outlet} color={node.color} />
        <NodeTag className={official ? "bg-primary/10 text-primary" : "bg-cabinet-blue/10 text-cabinet-blue"}>
          {t.node.outletLabel(t.node.outletTypes[node.type], node.language)}
        </NodeTag>
      </div>
      <div className="w-full text-[15px] font-black">{node.outlet}</div>
      <div className="flex items-center gap-[5px]">
        <CalendarIcon className="h-[13px] w-[13px] shrink-0 text-cabinet-ink-mid" />
        <span className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
          {node.date ?? t.node.noDate}
        </span>
      </div>
      <div className="line-clamp-4 w-full text-[13px] font-bold leading-[17px]">{node.quote}</div>
      {(node.changeLabel || node.stance) && (
        <div className="flex w-full min-w-0 flex-col items-start gap-1">
          {node.changeLabel && (
            <NodeTag className="bg-cabinet-inflated-soft text-cabinet-inflated-text">
              {node.changeLabel}
            </NodeTag>
          )}
          {node.stance && (
            <NodeTag className={STANCE_TONE[node.stance]}>{t.node.stances[node.stance]}</NodeTag>
          )}
        </div>
      )}
      {node.role === "root" && <FloatingLabel className="bg-primary">{t.node.earliest}</FloatingLabel>}
      {node.role === "prehistory" && (
        <FloatingLabel className="bg-cabinet-ink-mid">
          <HistoryIcon className="h-[13px] w-[13px]" />
          {t.node.prehistory}
        </FloatingLabel>
      )}
      {node.role === "debunk" && (
        <FloatingLabel className="bg-cabinet-old">
          <SearchIcon className="h-[13px] w-[13px]" />
          {t.node.debunk}
        </FloatingLabel>
      )}
    </div>
  );
}

export function MissingSourceCard({ node }: { node: MissingNode }) {
  const t = useCabinetText();
  return (
    <div className="flex w-[190px] flex-col items-start gap-1 rounded-[20px] p-3.5 outline outline-2 -outline-offset-1 outline-cabinet-ink-soft">
      <div className="flex items-center gap-1.5">
        <BrokenLinkIcon className="h-3.5 w-3.5 text-cabinet-ink-mid" />
        <span className="whitespace-nowrap text-[12px] font-extrabold text-cabinet-ink-mid">
          {t.node.missingSource}
        </span>
      </div>
      <div className="w-full text-[14px] font-black">{node.name}</div>
      <div className="w-full text-[12px] font-bold text-cabinet-ink-mid">{node.note}</div>
    </div>
  );
}

export function CheckedTextCard({ node }: { node: CheckedTextNode }) {
  const t = useCabinetText();
  return (
    <div className="flex w-[190px] flex-col items-start gap-2 rounded-[20px] bg-primary p-3.5">
      <div className="flex items-center gap-1.5">
        <QuotesIcon className="h-3.5 w-3.5 text-cabinet-split" />
        <span className="whitespace-nowrap text-[12px] font-extrabold text-cabinet-split">
          {t.node.checkedText}
        </span>
      </div>
      <div className="w-full text-[14px] font-extrabold leading-[18px] text-white">{node.quote}</div>
    </div>
  );
}

export function PlaceholderCard() {
  return (
    <div className="flex w-[190px] flex-col gap-2.5 rounded-[20px] bg-card p-3.5 opacity-80 outline outline-2 -outline-offset-1 outline-border">
      <div className="h-7 w-7 rounded-full bg-border" />
      <div className="h-2.5 w-[110px] rounded-[5px] bg-border" />
      <div className="h-2.5 w-[80px] rounded-[5px] bg-border" />
      <div className="h-2.5 w-full rounded-[5px] bg-border" />
      <div className="h-2.5 w-[120px] rounded-[5px] bg-border" />
    </div>
  );
}

export function UnlinkedCard({ items }: { items: UnlinkedPublication[] }) {
  const t = useCabinetText();
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 2);
  return (
    <div className="flex w-[190px] flex-col items-start gap-2.5 rounded-[20px] bg-canvas p-3.5 outline outline-2 -outline-offset-1 outline-border">
      <div className="flex w-full flex-col gap-0.5">
        <div className="whitespace-nowrap text-[14px] font-black">{t.node.unlinkedTitle}</div>
        <div className="w-full text-[12px] font-bold leading-[15px] text-cabinet-ink-mid">
          {t.node.unlinkedHint}
        </div>
      </div>
      {visibleItems.map((item) => {
        const content = (
          <>
            <Avatar name={item.outlet} color={item.color} size={24} textClassName="text-[11px]" />
            <div className="flex min-w-0 flex-col text-left">
              <div
                className={cn(
                  "text-[13px] font-black",
                  item.url && "underline decoration-border underline-offset-2",
                )}
              >
                {item.outlet}
              </div>
              <div className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">{item.date}</div>
            </div>
          </>
        );
        return item.url ? (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(event) => event.stopPropagation()}
            className="flex w-full items-center gap-2 rounded-md hover:opacity-75"
          >
            {content}
          </a>
        ) : (
          <div key={item.id} className="flex items-center gap-2">
            {content}
          </div>
        );
      })}
      {items.length > 2 && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setExpanded((value) => !value)}
          className="w-full text-left text-[12px] font-extrabold text-primary hover:underline"
        >
          {expanded ? t.search.collapse : t.node.moreItems(items.length - 2)}
        </button>
      )}
    </div>
  );
}

export function RootUnknownCard() {
  const t = useCabinetText();
  return (
    <div className="flex w-[210px] flex-col items-center gap-1.5 rounded-[20px] p-3.5 outline outline-2 -outline-offset-1 outline-cabinet-ink-soft">
      <QuestionIcon className="h-[26px] w-[26px] text-cabinet-ink-mid" />
      <div className="w-full text-center text-[15px] font-black">{t.node.rootUnknownTitle}</div>
      <div className="w-full text-center text-[13px] font-bold leading-[17px] text-cabinet-ink-mid">
        {t.node.rootUnknownHint}
      </div>
    </div>
  );
}

export function AlertGroupCard({ group }: { group: AlertGroup }) {
  const t = useCabinetText();
  return (
    <div className="flex w-[250px] flex-col gap-[9px] rounded-[20px] bg-card p-3.5 outline outline-[3px] -outline-offset-[1.5px] outline-cabinet-new">
      <div className="text-[15px] font-black">{group.title}</div>
      {group.publications.map((item) => (
        <div key={item.id} className="flex w-full items-center gap-2">
          <Avatar name={item.outlet} color={item.color} size={24} textClassName="text-[12px]" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="text-[13px] font-black">{item.outlet}</div>
            <div className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">{item.date}</div>
          </div>
          <span className="whitespace-nowrap rounded-full bg-cabinet-new px-2 py-0.5 text-[12px] font-extrabold text-white">
            {t.node.newBadge}
          </span>
        </div>
      ))}
    </div>
  );
}
