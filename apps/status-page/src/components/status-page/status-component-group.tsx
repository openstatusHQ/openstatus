"use client";

import {
  StatusComponentIcon,
  StatusComponentStatus,
} from "@openstatus/ui/components/blocks/status-component";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";

type VariantType = "success" | "degraded" | "error" | "info";

/**
 * StatusComponentGroup — collapsible aggregation of status components.
 *
 * Replaces the legacy `StatusTrackerGroup`. Renders the trigger with the
 * group title + aggregated status, and the children (individual `<StatusComponent>`
 * nodes) inside an animated collapsible region.
 */
export function StatusComponentGroup({
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
          "group/component flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 font-mono font-medium",
          "cursor-pointer",
          className,
        )}
        data-variant={status}
        {...props}
      >
        {title}
        <div className="flex items-center gap-2">
          <StatusComponentStatus className="text-sm" />
          <StatusComponentIcon />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        data-animate={mounted}
        className={cn(
          "border-border/50 flex flex-col gap-3 border-t px-3 py-2",
          "overflow-hidden",
          "data-[animate=true]:data-[state=closed]:animate-collapsible-up data-[animate=true]:data-[state=open]:animate-collapsible-down",
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
