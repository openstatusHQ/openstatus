"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertCircleIcon,
  CheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { useState } from "react";
import type { BarType, CardType, VariantType } from "./floating-button";
import { StatusTracker } from "./status-tracker";
import { type ChartData, getTotalUptime } from "./utils";

export function StatusMonitor({
  className,
  variant = "success",
  cardType = "duration",
  barType = "absolute",
  showUptime = true,
  data,
  monitor,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: VariantType;
  cardType?: CardType;
  barType?: BarType;
  showUptime?: boolean;
  monitor: {
    name: string;
    description: string;
  };
  data: ChartData[];
}) {
  const uptime = getTotalUptime(data);
  return (
    <div
      data-slot="status-monitor"
      data-variant={variant}
      className={cn("group/monitor flex flex-col gap-1", className)}
      {...props}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-row items-center gap-2">
          <StatusMonitorTitle>{monitor.name}</StatusMonitorTitle>
          <StatusMonitorDescription>
            {monitor.description}
          </StatusMonitorDescription>
        </div>
        <div className="flex flex-row items-center gap-2">
          {showUptime ? (
            <StatusMonitorUptime>{uptime}%</StatusMonitorUptime>
          ) : null}
          <StatusMonitorIcon />
        </div>
      </div>
      <StatusTracker cardType={cardType} barType={barType} data={data} />
      <div
        className={cn(
          "flex flex-row items-center justify-between text-muted-foreground text-xs",
          className,
        )}
        {...props}
      >
        <div>
          {data.length > 0
            ? formatDistanceToNowStrict(new Date(data[0]?.timestamp), {
                unit: "day",
              })
            : "-"}
        </div>
        <div>today</div>
      </div>
    </div>
  );
}

export function StatusMonitorTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-medium", className)} {...props}>
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
        "flex size-4 items-center justify-center rounded-full bg-muted text-background [&>svg]:size-2.5",
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
export function StatusMonitorUptime({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("font-mono text-muted-foreground text-sm", className)}
    >
      {children}
    </div>
  );
}

export function StatusMonitorStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(className)} {...props}>
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
