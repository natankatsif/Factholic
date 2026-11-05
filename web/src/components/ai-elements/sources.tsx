"use client";

import { BookIcon, ChevronDownIcon } from "lucide-react";
import React, { type ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { useSiteText } from "../../i18n/site";

export type SourcesProps = ComponentProps<typeof Collapsible>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible className={cn("not-prose text-xs text-foreground", className)} {...props} />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

const SourcesCount = ({ count }: { count: number }) => {
  const t = useSiteText();
  return <p className="m-0">{t.chat.sources(count)}</p>;
};

export const SourcesTrigger = ({ className, count, children, ...props }: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "group flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 font-bold text-muted-foreground hover:text-foreground",
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        <SourcesCount count={count} />
        <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({ className, ...props }: SourcesContentProps) => (
  <CollapsibleContent className={cn("mt-2 flex w-full flex-col gap-2 outline-none", className)} {...props} />
);

export type SourceProps = ComponentProps<"a">;

export const Source = ({ href, title, children, className, ...props }: SourceProps) => (
  <a
    className={cn("flex items-start gap-2 text-foreground no-underline hover:underline", className)}
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <BookIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="block font-bold">{title}</span>
      </>
    )}
  </a>
);
