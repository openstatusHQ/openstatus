"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function HintCollapsible({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Collapsible>) {
  return (
    <Collapsible
      className={cn(
        "bg-card text-card-foreground rounded-lg border transition-colors",
        "data-[state=closed]:hover:bg-muted/50 data-[state=open]:bg-muted/50",
        className,
      )}
      {...props}
    >
      {children}
    </Collapsible>
  );
}

export function HintCollapsibleTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-full cursor-pointer items-start justify-between gap-4 rounded-lg px-3 py-2 text-left select-none",
        className,
      )}
      {...props}
    >
      {/* spans with display:block — a <button> only allows phrasing content */}
      <span className="block space-y-1">{children}</span>
      <ChevronDown className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
}

export function HintCollapsibleTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("block text-sm leading-none font-semibold", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function HintCollapsibleDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground block text-sm", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function HintCollapsibleContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent {...props}>
      <div className={cn("space-y-4 px-3 pt-1 pb-3 text-sm", className)}>
        {children}
      </div>
    </CollapsibleContent>
  );
}
