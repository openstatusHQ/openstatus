"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertCircleIcon,
  CheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { useState } from "react";
import type { VariantType } from "./floating-button";
import { StatusTracker, StatusTrackerSkeleton } from "./status-tracker";

// TODO: use status instead of variant

type Data = NonNullable<
  RouterOutputs["statusPage"]["getUptime"]
>[number]["data"];

export function StatusMonitor({
  className,
  status = "success",
  showUptime = true,
  data = [],
  monitor,
  uptime,
  isLoading = false,
  ...props
}: React.ComponentProps<"div"> & {
  status?: VariantType;
  showUptime?: boolean;
  uptime?: string;
  monitor: {
    name: string;
    description: string;
  };
  data?: Data;
  isLoading?: boolean;
}) {
  return (
    <div
      data-slot="status-monitor"
      data-variant={status}
      className={cn("group/monitor flex flex-col gap-1", className)}
      {...props}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex min-w-0 flex-row items-center gap-2">
          <StatusMonitorTitle>{monitor.name}</StatusMonitorTitle>
          <StatusMonitorDescription>
            {monitor.description}
          </StatusMonitorDescription>
        </div>
        <div className="flex flex-row items-center gap-2">
          {/* TODO: check if we can improve that cuz its looking ugly */}
          {showUptime ? (
            <>
              {isLoading ? (
                <StatusMonitorUptimeSkeleton />
              ) : (
                <StatusMonitorUptime>{uptime}</StatusMonitorUptime>
              )}
              <StatusMonitorIcon />
            </>
          ) : (
            <StatusMonitorStatus />
          )}
        </div>
      </div>
      {isLoading ? <StatusTrackerSkeleton /> : <StatusTracker data={data} />}
      <StatusMonitorFooter data={data} isLoading={isLoading} />
    </div>
  );
}

export function StatusMonitorTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "truncate font-medium font-mono text-foreground text-base leading-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusMonitorDescription({
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

export function StatusMonitorIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-[12.5px] items-center justify-center rounded-full bg-muted text-background [&>svg]:size-[9px]",
        "group-data-[variant=success]/monitor:bg-success",
        "group-data-[variant=degraded]/monitor:bg-warning",
        "group-data-[variant=error]/monitor:bg-destructive",
        "group-data-[variant=info]/monitor:bg-info",
        className,
      )}
      {...props}
    >
      <CheckIcon className="hidden group-data-[variant=success]/monitor:block" />
      <TriangleAlertIcon className="hidden group-data-[variant=degraded]/monitor:block" />
      <AlertCircleIcon className="hidden group-data-[variant=error]/monitor:block" />
      <WrenchIcon className="hidden group-data-[variant=info]/monitor:block" />
    </div>
  );
}

export function StatusMonitorFooter({
  data,
  isLoading,
}: {
  data: Data;
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

export function StatusMonitorUptime({
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

export function StatusMonitorUptimeSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-4 w-16", className)} {...props} />;
}

export function StatusMonitorStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-mono text-sm leading-none",
        "group-data-[variant=success]/monitor:text-success",
        "group-data-[variant=degraded]/monitor:text-warning",
        "group-data-[variant=error]/monitor:text-destructive",
        "group-data-[variant=info]/monitor:text-info",
        className,
      )}
      {...props}
    >
      <span className="hidden group-data-[variant=success]/monitor:block">
        Operational
      </span>
      <span className="hidden group-data-[variant=degraded]/monitor:block">
        Degraded
      </span>
      <span className="hidden group-data-[variant=error]/monitor:block">
        Downtime
      </span>
      <span className="hidden group-data-[variant=info]/monitor:block">
        Maintenance
      </span>
    </div>
  );
}
