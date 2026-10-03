"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { CheckCircleIcon, ChevronDownIcon, CircleIcon, ClockIcon, XCircleIcon } from "lucide-react";
import React, { type ComponentProps, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose w-full rounded-[16px] border border-border bg-background", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Ждёт подтверждения",
  "approval-responded": "Подтверждено",
  "input-available": "Выполняется",
  "input-streaming": "Готовится",
  "output-available": "Готово",
  "output-denied": "Отклонено",
  "output-error": "Ошибка",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-3.5 text-[#FFC20E]" />,
  "approval-responded": <CheckCircleIcon className="size-3.5 text-[#1660D6]" />,
  "input-available": <ClockIcon className="size-3.5 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-3.5" />,
  "output-available": <CheckCircleIcon className="size-3.5 text-[#1DA57A]" />,
  "output-denied": <XCircleIcon className="size-3.5 text-[#FF7A12]" />,
  "output-error": <XCircleIcon className="size-3.5 text-[#E2353F]" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
    {statusIcons[status]}
    {statusLabels[status]}
  </span>
);

export type ToolHeaderProps = {
  title: ReactNode;
  icon?: ReactNode;
  state: ToolPart["state"];
  className?: string;
};

export const ToolHeader = ({ className, title, icon, state, ...props }: ToolHeaderProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-3 py-2.5 text-left",
      className,
    )}
    {...props}
  >
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <span className="min-w-0 truncate text-[13px] font-bold text-foreground">{title}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent className={cn("space-y-3 px-3 pb-3 outline-none", className)} {...props} />
);
