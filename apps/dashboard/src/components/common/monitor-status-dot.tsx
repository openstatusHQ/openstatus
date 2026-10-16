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
  const text =
    label ??
    (!monitor.active
      ? "Inactive"
      : monitor.status === "active"
        ? "Normal"
        : monitor.status === "error"
          ? "Failing"
          : "Degraded");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can open the tooltip */}
        <span tabIndex={0} className={cn("relative inline-flex", className)}>
          {!monitor.active ? (
            <span className="bg-muted-foreground/70 relative inline-flex h-2.5 w-2.5 rounded-full" />
          ) : monitor.status === "active" ? (
            <>
              <span className="bg-success/80 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-success relative inline-flex h-2.5 w-2.5 rounded-full" />
            </>
          ) : monitor.status === "error" ? (
            <span className="bg-destructive relative inline-flex h-2.5 w-2.5 rounded-full" />
          ) : (
            <span className="bg-warning relative inline-flex h-2.5 w-2.5 rounded-full" />
          )}
          <span className="sr-only">{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
