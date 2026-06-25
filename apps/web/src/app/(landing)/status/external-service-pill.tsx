import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";

export type ExternalServicePillProps = {
  indicator: string;
  status: string;
  statusMessage?: string;
  escalated?: boolean;
  className?: string;
};

const ESCALATED_TITLE =
  "This status is raised by user reports; the provider has not reported an issue.";

type PillStyle = {
  label: string;
  className: string;
};

const MAINTENANCE: PillStyle = {
  label: "Maintenance",
  className: "bg-info/15 text-info border-info/30",
};

const INDICATOR_PILLS: Record<string, PillStyle> = {
  none: {
    label: "Operational",
    className: "bg-success/15 text-success border-success/30",
  },
  minor: {
    label: "Minor Issue",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  major: {
    label: "Partial Outage",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  critical: {
    label: "Major Outage",
    className: "bg-destructive/20 text-destructive border-destructive/40",
  },
};

const UNKNOWN_PILL: PillStyle = {
  label: "Unknown",
  className: "bg-muted text-muted-foreground border-muted-foreground/20",
};

export function getPillStyle(args: {
  indicator: string;
  status: string;
}): PillStyle {
  if (args.status === "under_maintenance") return MAINTENANCE;
  return INDICATOR_PILLS[args.indicator] ?? UNKNOWN_PILL;
}

export function ExternalServicePill({
  indicator,
  status,
  statusMessage,
  escalated,
  className,
}: ExternalServicePillProps) {
  const pill = getPillStyle({ indicator, status });
  const pillSpan = (
    <span
      className={cn(
        "inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-medium",
        pill.className,
        className,
      )}
    >
      {pill.label}
    </span>
  );

  const pillWithMessage = statusMessage ? (
    <Tooltip>
      <TooltipTrigger asChild>{pillSpan}</TooltipTrigger>
      <TooltipContent className="rounded-none">{statusMessage}</TooltipContent>
    </Tooltip>
  ) : (
    pillSpan
  );

  if (!escalated) return pillWithMessage;

  return (
    <span className="inline-flex items-center gap-1.5">
      {pillWithMessage}
      <span
        title={ESCALATED_TITLE}
        className="border-warning/30 text-warning inline-flex items-center rounded-none border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase"
      >
        user-reported
      </span>
    </span>
  );
}
