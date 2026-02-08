"use client";

import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useMediaQuery } from "@openstatus/ui/hooks/use-media-query";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { InfoIcon } from "lucide-react";
import { useState } from "react";
import { StatusIcon as UnifiedStatusIcon } from "@openstatus/ui/components/blocks/status-icon";
import type { StatusBarData } from "@openstatus/ui/components/blocks/status.types";
import { systemStatusLabels } from "@openstatus/ui/components/blocks/status.utils";

// NOTE: The main StatusComponent composed component has been removed - it contained business logic
// The app should compose these primitives based on its own business logic

// maybe add a StatusComponent as example how to use the primitives

export function StatusComponentTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "truncate font-medium font-mono text-base text-foreground leading-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentDescription({
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof TooltipTrigger>) {
  const isTouch = useMediaQuery("(hover: none)");
  const [open, setOpen] = useState(false);

  if (!children) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          onClick={(e) => {
            if (isTouch) setOpen((prev) => !prev);
            onClick?.(e);
          }}
          className="rounded-full"
          {...props}
        >
          <InfoIcon className="size-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{children}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusComponentIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon variant="component" className={className} {...props} />
  );
}

export function StatusComponentFooter({
  data,
  isLoading,
}: {
  data: StatusBarData[];
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-row items-center justify-between font-mono text-muted-foreground text-xs leading-none">
      <div>
        {isLoading ? (
          <Skeleton className="h-3 w-18" />
        ) : data.length > 0 ? (
          formatDistanceToNowStrict(new Date(data[0].day), {
            unit: "day",
            addSuffix: true,
          })
        ) : (
          "-"
        )}
      </div>
      <div>today</div>
    </div>
  );
}

export function StatusComponentUptime({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "font-mono text-foreground/80 text-sm leading-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusComponentUptimeSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-4 w-16", className)} {...props} />;
}

export function StatusComponentStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-mono text-sm leading-none",
        "group-data-[variant=success]/component:text-success",
        "group-data-[variant=degraded]/component:text-warning",
        "group-data-[variant=error]/component:text-destructive",
        "group-data-[variant=info]/component:text-info",
        className,
      )}
      {...props}
    >
      <span className="hidden group-data-[variant=success]/component:block">
        {systemStatusLabels.success.short}
      </span>
      <span className="hidden group-data-[variant=degraded]/component:block">
        {systemStatusLabels.degraded.short}
      </span>
      <span className="hidden group-data-[variant=error]/component:block">
        {systemStatusLabels.error.short}
      </span>
      <span className="hidden group-data-[variant=info]/component:block">
        {systemStatusLabels.info.short}
      </span>
    </div>
  );
}
