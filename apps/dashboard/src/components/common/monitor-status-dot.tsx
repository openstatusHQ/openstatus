import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";

import {
  type MonitorHealth,
  getMonitorHealth,
  monitorHealthConfig,
} from "@/data/monitors.client";

const dotColor = {
  inactive: "bg-muted-foreground/70",
  active: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
} as const satisfies Record<MonitorHealth, string>;

export function MonitorStatusDot({
  monitor,
  label,
  className,
}: {
  monitor: Parameters<typeof getMonitorHealth>[0];
  /** Overrides the default tooltip text */
  label?: React.ReactNode;
  className?: string;
}) {
  const health = getMonitorHealth(monitor);
  const text = label ?? monitorHealthConfig[health].label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can open the tooltip */}
        <span tabIndex={0} className={cn("relative inline-flex", className)}>
          {health === "active" ? (
            <span className="bg-success/80 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          ) : null}
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              dotColor[health],
            )}
          />
          <span className="sr-only">{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
