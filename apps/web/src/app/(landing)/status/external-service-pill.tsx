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
  dot: string;
  text: string;
};

const MAINTENANCE: PillStyle = {
  label: "Maintenance",
  className: "bg-info/15 text-info border-info/30",
  dot: "bg-info",
  text: "text-info",
};

const INDICATOR_PILLS: Record<string, PillStyle> = {
  none: {
    label: "Operational",
    className: "bg-success/15 text-success border-success/30",
    dot: "bg-success",
    text: "text-success",
  },
  minor: {
    label: "Minor Issue",
    className: "bg-warning/15 text-warning border-warning/30",
    dot: "bg-warning",
    text: "text-warning",
  },
  major: {
    label: "Partial Outage",
    className: "bg-destructive/15 text-destructive border-destructive/30",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  critical: {
    label: "Major Outage",
    className: "bg-destructive/20 text-destructive border-destructive/40",
    dot: "bg-destructive",
    text: "text-destructive",
  },
};

const UNKNOWN_PILL: PillStyle = {
  label: "Unknown",
  className: "bg-muted text-muted-foreground border-muted-foreground/20",
  dot: "bg-muted-foreground/40",
  text: "text-muted-foreground",
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

export function ServiceStatusLabel({
  indicator,
  status,
  escalated,
  quietWhenOk,
  className,
}: {
  indicator: string;
  status: string;
  escalated?: boolean;
  // In long lists only problems carry a visible label; "ok" is just the dot.
  quietWhenOk?: boolean;
  className?: string;
}) {
  const pill = getPillStyle({ indicator, status });
  const label = escalated ? "User-reported" : pill.label;
  const quiet = quietWhenOk && !escalated && pill.label === "Operational";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap",
        pill.text,
        className,
      )}
      title={escalated ? ESCALATED_TITLE : undefined}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0", pill.dot)} />
      <span className={quiet ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
