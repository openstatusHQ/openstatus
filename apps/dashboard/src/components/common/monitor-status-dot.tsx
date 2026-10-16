import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";

export function MonitorStatusDot({
  monitor,
  label,
  className,
}: {
  monitor: { active: boolean | null; status: string };
  /** Overrides the default tooltip text */
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {!monitor.active ? (
          <span className={cn("relative inline-flex", className)}>
            <span className="bg-muted-foreground/70 relative inline-flex h-2.5 w-2.5 rounded-full" />
          </span>
        ) : monitor.status === "active" ? (
          <span className={cn("relative inline-flex", className)}>
            <span className="bg-success/80 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-success relative inline-flex h-2.5 w-2.5 rounded-full" />
          </span>
        ) : monitor.status === "error" ? (
          <span className={cn("relative inline-flex", className)}>
            <span className="bg-destructive relative inline-flex h-2.5 w-2.5 rounded-full" />
          </span>
        ) : (
          <span className={cn("relative inline-flex", className)}>
            <span className="bg-warning relative inline-flex h-2.5 w-2.5 rounded-full" />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {label ??
          (!monitor.active
            ? "Inactive"
            : monitor.status === "active"
              ? "Normal"
              : monitor.status === "error"
                ? "Failing"
                : "Degraded")}
      </TooltipContent>
    </Tooltip>
  );
}
