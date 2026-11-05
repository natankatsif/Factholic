/** Правая панель: шапка тезиса, лента, настройки слежения, заглушка до проверки */
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { useCabinetText } from "./dictionary";
import {
  BellIcon,
  EyeIcon,
  ListChecksIcon,
  ProhibitIcon,
  QuestionIcon,
  RadioOffIcon,
  RadioOnIcon,
  RetryIcon,
  SaveIcon,
  ScalesIcon,
  SearchIcon,
  SearchMinusIcon,
  TreeIcon,
  TrendUpIcon,
} from "./icons";
import type {
  AlertTarget,
  CabinetLimits,
  CheckView,
  ClaimStatus,
  FeedItem,
  HomeView,
  SidesSummary,
} from "./types";
import { IconCircle, Pill, StatusPill } from "./ui";

const BUTTON =
  "flex items-center justify-center gap-1.5 rounded-full px-4 py-[9px] text-[14px] font-extrabold whitespace-nowrap";
const BUTTON_DARK = cn(BUTTON, "bg-primary text-white");
const BUTTON_OUTLINE = cn(BUTTON, "outline outline-2 -outline-offset-1 outline-primary");
const TEXT = "w-full text-[14px] font-bold leading-[19px]";
const ICON = "h-[17px] w-[17px]";

/** В шапке панели статус new фиолетовый, в таблицах синий: так на экранах дизайна */
const HEADER_STATUS: Partial<Record<ClaimStatus, string>> = { new: "bg-cabinet-old-soft text-cabinet-old" };

function PanelShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const t = useCabinetText();
  return (
    <aside className="-ml-px flex h-full w-[381px] shrink-0 flex-col border-l-2 border-border bg-card">
      {children}
      {footer ?? (
        <div className="-mt-px flex h-[61px] shrink-0 items-center gap-2.5 border-t-2 border-border px-[22px] py-3.5">
          <ScalesIcon className="h-[18px] w-[18px] shrink-0 text-cabinet-ink-mid" />
          <div className="flex-1 text-[12px] font-bold leading-4 text-cabinet-ink-mid">
            {t.panel.disclaimer}
          </div>
        </div>
      )}
    </aside>
  );
}

function PanelHeader({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "-mb-px flex shrink-0 flex-col gap-2.5 border-b-2 border-border p-[22px]",
        children ? "min-h-[155px]" : "h-24",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-1 w-5 rounded-sm bg-cabinet-inflated" />
        <span className="whitespace-nowrap text-[13px] font-extrabold text-cabinet-ink-mid">{label}</span>
      </div>
      <div className="w-full text-[19px] font-black leading-[23px]">{title}</div>
      {children && <div className="flex items-center gap-2.5">{children}</div>}
    </div>
  );
}

function FeedRow({
  icon,
  title,
  time,
  children,
}: {
  icon: ReactNode;
  title: string;
  time?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full items-start gap-3">
      {icon}
      <div className="flex flex-1 flex-col items-start gap-1.5">
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0 text-[15px] font-black">{title}</div>
          {time && (
            <div className="shrink-0 whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
              {time}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function SideTiles({ sides }: { sides: SidesSummary }) {
  const t = useCabinetText();
  const tiles = [
    { value: sides.for, label: t.feed.sideFor, tone: "bg-cabinet-agree-soft" },
    { value: sides.against, label: t.feed.sideAgainst, tone: "bg-cabinet-against-soft" },
    { value: sides.partial, label: t.feed.sidePartial, tone: "bg-cabinet-split-soft" },
  ];
  return (
    <div className="flex w-full items-start gap-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn("flex flex-1 flex-col items-center rounded-[14px] px-1 py-2", tile.tone)}
        >
          <div className="whitespace-nowrap text-[20px] font-black">{tile.value}</div>
          <div className="whitespace-nowrap text-[12px] font-extrabold">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

export interface FeedActions {
  onWatch: () => void;
  onDismissOffer: () => void;
  /** Показать обновление на дереве; без блоков — подсветка из макета */
  onShowAlert: (target?: AlertTarget, nodeId?: string) => void;
  onConfigure: () => void;
  onRetry: () => void;
  claimChoice: number;
  onChooseClaim: (index: number) => void;
}

const MAX_UPDATE_LINKS = 5;

/** Новые публикации обновления: клик ведёт к блоку на холсте */
function UpdateLinks({ item, onShow }: { item: AlertTarget; onShow: FeedActions["onShowAlert"] }) {
  const t = useCabinetText();
  const list = item.publications ?? [];
  if (list.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-1">
      {list.slice(0, MAX_UPDATE_LINKS).map((publication) => (
        <button
          key={publication.nodeId}
          type="button"
          onClick={() => onShow(item, publication.nodeId)}
          className="flex w-full items-center justify-between gap-2 rounded-[10px] bg-card/70 px-2.5 py-1.5 text-left hover:bg-card"
        >
          <span className="min-w-0 truncate text-[13px] font-extrabold">{publication.name}</span>
          <span className="shrink-0 whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">
            {publication.date}
          </span>
        </button>
      ))}
      {list.length > MAX_UPDATE_LINKS && (
        <span className="px-2.5 text-[12px] font-bold text-cabinet-ink-mid">
          {t.feed.moreUpdates(list.length - MAX_UPDATE_LINKS)}
        </span>
      )}
    </div>
  );
}

function FeedEntry({ item, actions }: { item: FeedItem; actions: FeedActions }) {
  const t = useCabinetText();
  const link = "whitespace-nowrap text-[13px] font-extrabold";
  switch (item.type) {
    case "claims":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-primary/10">
              <ListChecksIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.claimsFoundTitle}
          time={item.time}
        >
          <div className={TEXT}>
            {item.count === 1 ? t.feed.claimsFoundOne : t.feed.claimsFoundMany(item.count)}
          </div>
          {item.options?.map((option, index) => {
            const active = index === actions.claimChoice;
            const Radio = active ? RadioOnIcon : RadioOffIcon;
            return (
              <button
                key={option}
                type="button"
                onClick={() => actions.onChooseClaim(index)}
                className={cn(
                  "flex w-full gap-2 rounded-[14px] px-3 py-2.5 text-left outline outline-2 -outline-offset-1",
                  active ? "bg-canvas outline-primary" : "outline-border",
                )}
              >
                <Radio className={cn(ICON, "shrink-0")} />
                <span className="flex-1 text-[14px] font-extrabold leading-[18px]">{option}</span>
              </button>
            );
          })}
        </FeedRow>
      );
    case "searching":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-cabinet-blue/10">
              <SearchIcon className={cn(ICON, "text-cabinet-blue")} />
            </IconCircle>
          }
          title={t.feed.searchingTitle}
          time={t.feed.now}
        >
          <div className={TEXT}>{t.feed.searchingText}</div>
        </FeedRow>
      );
    case "result":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-cabinet-split-soft">
              <TreeIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.resultTitle}
          time={item.time}
        >
          <div className="w-full text-[16px] font-black first-letter:uppercase">
            {item.summary ?? t.feed.sidesDiverge}
          </div>
          <SideTiles sides={item.sides} />
          <div className={TEXT}>
            {[item.earliest && t.feed.earliest(item.earliest.outlet, item.earliest.date), item.note]
              .filter(Boolean)
              .join(" ")}
          </div>
        </FeedRow>
      );
    case "offer": {
      const few = item.variant === "few";
      return (
        <div className="flex w-full flex-col gap-2.5 rounded-[20px] bg-canvas p-4">
          <div className="w-full text-[16px] font-black">
            {few ? t.feed.fewOfferTitle : t.feed.offerTitle}
          </div>
          <div className={TEXT}>{few ? t.feed.fewOfferText : t.feed.offerText}</div>
          <div className="flex items-start gap-2">
            <button type="button" onClick={actions.onWatch} className={BUTTON_DARK}>
              <EyeIcon className="h-[15px] w-[15px]" />
              {t.feed.watch}
            </button>
            <button type="button" onClick={actions.onDismissOffer} className={BUTTON_OUTLINE}>
              {t.feed.notNow}
            </button>
          </div>
        </div>
      );
    }
    case "alert":
      return (
        <div className="flex w-full flex-col gap-2 rounded-[20px] bg-cabinet-new-soft p-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendUpIcon className="h-[18px] w-[18px] shrink-0 text-cabinet-new" />
              <span className="text-[16px] font-black">{t.feed.newAlert(item.title)}</span>
            </div>
            <span className="whitespace-nowrap text-[12px] font-bold text-cabinet-ink-mid">{item.time}</span>
          </div>
          <div className={TEXT}>{item.text}</div>
          <UpdateLinks item={item} onShow={actions.onShowAlert} />
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => actions.onShowAlert(item)} className={BUTTON_DARK}>
              <TreeIcon className="h-[15px] w-[15px]" />
              {t.feed.showOnTree}
            </button>
          </div>
        </div>
      );
    case "debunk":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-cabinet-old-soft">
              <SearchIcon className={cn(ICON, "text-cabinet-old")} />
            </IconCircle>
          }
          title={item.title}
          time={item.time}
        >
          <div className={TEXT}>{item.text}</div>
          <UpdateLinks item={item} onShow={actions.onShowAlert} />
          {(item.nodeIds === undefined || item.nodeIds.length > 0) && (
            <button type="button" onClick={() => actions.onShowAlert(item)} className={link}>
              {t.feed.showOnTree}
            </button>
          )}
        </FeedRow>
      );
    case "watch-on":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-cabinet-agree-soft">
              <EyeIcon className={cn(ICON, "text-cabinet-agree")} />
            </IconCircle>
          }
          title={t.feed.watchOnTitle}
          time={item.time}
        >
          <div className={TEXT}>{item.text}</div>
          <button type="button" onClick={actions.onConfigure} className={link}>
            {t.feed.configure}
          </button>
        </FeedRow>
      );
    case "result-short":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-cabinet-split-soft">
              <TreeIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.resultTitle}
          time={item.time}
        >
          <div className={TEXT}>{item.text}</div>
        </FeedRow>
      );
    case "failed":
      return (
        <div className="flex w-full flex-col gap-2 rounded-[20px] bg-cabinet-against-soft p-4">
          <div className="whitespace-nowrap text-[16px] font-black">{t.feed.searchFailedTitle}</div>
          <div className={TEXT}>{t.feed.searchFailedText}</div>
          <div className="flex items-start gap-2">
            <button type="button" onClick={actions.onRetry} className={BUTTON_DARK}>
              <RetryIcon className="h-[15px] w-[15px]" />
              {t.feed.retry}
            </button>
          </div>
        </div>
      );
    case "saved":
      return <SavedRow time={item.time} count={item.count} />;
    case "few-sources":
      return <FewSourcesRow time={item.time} count={item.count} />;
    case "root-unknown":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-primary/10">
              <QuestionIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.rootUnknownTitle}
          time={item.time}
        >
          <div className={TEXT}>{t.feed.rootUnknownText(item.outlet)}</div>
        </FeedRow>
      );
    case "no-publications":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-cabinet-split-soft">
              <SearchMinusIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.noPublicationsTitle}
          time={item.time}
        >
          <div className={TEXT}>{t.feed.noPublicationsText}</div>
        </FeedRow>
      );
    case "root-unknown-plain":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-primary/10">
              <QuestionIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.rootUnknownTitle}
          time={item.time}
        >
          <div className={TEXT}>{t.node.rootUnknownHint}</div>
        </FeedRow>
      );
    case "not-checked":
      return (
        <FeedRow
          icon={
            <IconCircle className="bg-primary/10">
              <ProhibitIcon className={ICON} />
            </IconCircle>
          }
          title={t.feed.notCheckedTitle}
          time={item.time}
        >
          <ul className="flex w-full flex-col gap-1">
            {item.items.map((text) => (
              <li key={text} className="flex gap-2 text-[14px] font-bold leading-[18px]">
                <span aria-hidden="true">·</span>
                <span className="flex-1">{text}</span>
              </li>
            ))}
          </ul>
        </FeedRow>
      );
  }
}

function SavedRow({ time, count }: { time: string; count: number }) {
  const t = useCabinetText();
  return (
    <FeedRow
      icon={
        <IconCircle className="bg-primary/10">
          <SaveIcon className={ICON} />
        </IconCircle>
      }
      title={t.feed.savedTitle}
      time={time}
    >
      <div className={TEXT}>{t.feed.savedText(count, t.plural(count, t.canvas.publications))}</div>
    </FeedRow>
  );
}

function FewSourcesRow({ time, count }: { time: string; count: number }) {
  const t = useCabinetText();
  return (
    <FeedRow
      icon={
        <IconCircle className="bg-cabinet-split-soft">
          <SearchMinusIcon className={ICON} />
        </IconCircle>
      }
      title={t.feed.fewSourcesTitle}
      time={time}
    >
      <div className={TEXT}>{t.feed.fewSourcesText(count, t.plural(count, t.canvas.publications))}</div>
    </FeedRow>
  );
}

function ClaimStatusLine({ check }: { check: CheckView }) {
  const t = useCabinetText();
  const time = check.watchFrequency
    ? check.watchFrequency === "daily"
      ? t.panel.watchingDaily
      : t.panel.watchingWeekly
    : check.timeLabel;
  return (
    <>
      {check.status === "running" && (
        <Pill className="bg-cabinet-blue/10 text-cabinet-blue">{t.panel.checkRunning}</Pill>
      )}
      {check.status === "failed" && (
        <Pill className="bg-cabinet-against-soft text-cabinet-against-text">{t.panel.checkFailed}</Pill>
      )}
      {check.status === "done" && check.claimStatus && (
        <StatusPill status={check.claimStatus} className={HEADER_STATUS[check.claimStatus]} />
      )}
      {time && <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">{time}</span>}
    </>
  );
}

export function CheckFeedPanel({
  check,
  offerHidden,
  actions,
}: {
  check: CheckView;
  offerHidden: boolean;
  actions: FeedActions;
}) {
  const t = useCabinetText();
  const items = check.feed.filter((item) => !(offerHidden && item.type === "offer"));
  return (
    <PanelShell>
      <PanelHeader label={t.panel.selectedClaim} title={check.claim}>
        <ClaimStatusLine check={check} />
      </PanelHeader>
      <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[22px] overflow-y-auto overscroll-none p-[22px]">
        {items.map((item, index) => (
          <FeedEntry key={index} item={item} actions={actions} />
        ))}
      </div>
    </PanelShell>
  );
}

function UsageBar({
  label,
  used,
  total,
  danger,
}: {
  label: string;
  used: number;
  total: number;
  danger?: boolean;
}) {
  const t = useCabinetText();
  return (
    <div className="flex w-full flex-col gap-[5px]">
      <div className="flex w-full justify-between">
        <span className="whitespace-nowrap text-[13px] font-bold text-cabinet-ink-mid">{label}</span>
        <span
          className={cn("whitespace-nowrap text-[13px] font-black", danger && "text-cabinet-against-text")}
        >
          {t.panel.usage(used, total)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-border">
        <div
          className={cn("h-full rounded-[3px]", danger ? "bg-destructive" : "bg-primary")}
          style={{ width: `${Math.min(100, (used / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

const PREVIEW_ICONS = {
  result: TreeIcon,
  watch: EyeIcon,
  alerts: BellIcon,
};

export function EmptyPanel({ home, limits }: { home: HomeView; limits?: CabinetLimits }) {
  const t = useCabinetText();
  const limitReached = home.state === "limit";
  return (
    <PanelShell>
      <PanelHeader
        label={t.panel.feedTitle}
        title={home.state === "no-claims" ? t.panel.noClaims : t.panel.noClaim}
      />
      <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[18px] overflow-y-auto overscroll-none p-[22px]">
        <div className="w-full text-[15px] font-black">{t.panel.afterCheck}</div>
        {t.panel.previews.map((preview) => {
          const Icon = PREVIEW_ICONS[preview.key as keyof typeof PREVIEW_ICONS];
          return (
            <div key={preview.key} className="flex w-full items-start gap-3">
              <IconCircle className="bg-canvas">
                <Icon className={ICON} />
              </IconCircle>
              <div className="flex flex-1 flex-col items-start gap-0.5">
                <div className="w-full text-[14px] font-black">{preview.title}</div>
                <div className="w-full text-[13px] font-bold leading-[17px] text-cabinet-ink-mid">
                  {preview.text}
                </div>
              </div>
            </div>
          );
        })}
        {limits && (
          <div className="flex w-full flex-col gap-2.5 rounded-[20px] bg-canvas p-4">
            <UsageBar
              label={t.panel.checksThisMonth(limits.month)}
              used={limits.checksUsed}
              total={limits.checksTotal}
              danger={limitReached}
            />
            <UsageBar label={t.panel.watchesLimit} used={limits.watchesUsed} total={limits.watchesTotal} />
            {limitReached && (
              <div className="w-full text-[13px] font-bold leading-[17px] text-cabinet-ink-mid">
                {t.panel.limitHint(limits.resetDate)}
              </div>
            )}
          </div>
        )}
        {!limitReached && home.recent.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-center justify-between">
              <div className="whitespace-nowrap text-[15px] font-black">{t.panel.recentQuestions}</div>
              <Link href="/cabinet/questions" className="whitespace-nowrap text-[13px] font-extrabold">
                {t.panel.allQuestions}
              </Link>
            </div>
            {home.recent.map((question) => (
              <div key={question.id} className="flex w-full flex-col">
                <div className="w-full text-[14px] font-extrabold leading-[18px]">{question.text}</div>
                <div className="text-[12px] font-bold text-cabinet-ink-mid">{question.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export { PanelShell, PanelHeader, BUTTON_DARK, BUTTON_OUTLINE };
