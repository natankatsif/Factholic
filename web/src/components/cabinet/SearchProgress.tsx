/** Блок «Ход поиска»: шаги приходят из данных проверки */
import { useCabinetText } from "./dictionary";
import {
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  DashedCircleIcon,
  SpinnerIcon,
  XCircleIcon,
} from "./icons";
import type { SearchStep } from "./types";
import { cn } from "../../lib/utils";

function StepIcon({ status }: { status: SearchStep["status"] }) {
  const size = "h-[17px] w-[17px] shrink-0";
  if (status === "done") return <CheckCircleIcon className={cn(size, "text-cabinet-agree")} />;
  if (status === "running") return <SpinnerIcon className={cn(size, "animate-spin text-cabinet-blue")} />;
  if (status === "failed") return <XCircleIcon className={cn(size, "text-destructive")} />;
  return <DashedCircleIcon className={cn(size, "text-cabinet-ink-soft")} />;
}

export function SearchProgress({
  steps,
  open,
  onToggle,
}: {
  steps: SearchStep[];
  open: boolean;
  onToggle: () => void;
}) {
  const t = useCabinetText();
  return (
    <div className="absolute left-6 top-[min(586px,calc(100%-366px))] z-20 flex w-[262px] flex-col gap-2.5 rounded-[20px] bg-card p-3.5 outline outline-2 -outline-offset-1 outline-border">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between">
        <span className="whitespace-nowrap text-[15px] font-black">{t.search.title}</span>
        {open ? (
          <CaretUpIcon className="h-4 w-4 text-cabinet-ink-mid" aria-label={t.search.collapse} />
        ) : (
          <CaretDownIcon className="h-4 w-4 text-cabinet-ink-mid" aria-label={t.search.expand} />
        )}
      </button>
      {open &&
        steps.map((step) => (
          <div key={step.key} className="flex w-full items-start gap-2">
            <StepIcon status={step.status} />
            <div
              className={cn(
                "flex-1 text-[13px] leading-4",
                step.status === "waiting" && "font-bold text-cabinet-ink-mid",
                step.status === "done" && "font-bold",
                (step.status === "running" || step.status === "failed") && "font-black",
              )}
            >
              {step.status === "failed" ? t.search.failedStep : t.search.steps[step.key]}
            </div>
            {step.found !== undefined && <div className="text-[13px] font-black">{step.found}</div>}
          </div>
        ))}
    </div>
  );
}
