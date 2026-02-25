"use client";

import type { VariantType } from "./floating-button";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";

import { StatusMonitorIcon, StatusMonitorStatus } from "./status-monitor";

export function StatusTrackerGroup({
  children,
  title,
  status,
  className,
  defaultOpen = false,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
  status?: VariantType;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        "-mx-3",
        "bg-muted/50 hover:border-border/50 data-[state=open]:border-border/50 data-[state=open]:bg-muted/50 rounded-lg border border-transparent",
        className,
      )}
    >
      <CollapsibleTrigger
        className={cn(
          "group/monitor flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 font-mono font-medium",
          "cursor-pointer",
          className,
        )}
        data-variant={status}
        {...props}
      >
        {title}
        <div className="flex items-center gap-2">
          <StatusMonitorStatus className="text-sm" />
          <StatusMonitorIcon />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        data-animate={mounted}
        className={cn(
          "border-border/50 flex flex-col gap-3 border-t px-3 py-2",
          "overflow-hidden",
          // REMINDER: otherwise, if defaultOpen is true, the animation will be triggered and we have a layout shift
          "data-[animate=true]:data-[state=closed]:animate-collapsible-up data-[animate=true]:data-[state=open]:animate-collapsible-down",
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
