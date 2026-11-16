import type {
  IncidentTargetTimer,
  IncidentTargetTimerStatus,
} from "@openstatus/db/src/schema/incident_response_targets/state";
import { cn } from "@openstatus/ui/lib/utils";

import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
import { slaTimerPhrase } from "@/data/incident-target.client";

const variant = {
  running: "default",
  at_risk: "warning",
  met: "success",
  breached: "destructive",
} as const satisfies Record<IncidentTargetTimerStatus, StatusVariant>;

// sm sits in a line of text; md leads a property value like the Status dot.
const dotSize = {
  sm: "mr-1.5 mb-px size-1.5",
  md: "mr-2 mb-px",
} as const;

const tone = {
  running: "",
  at_risk: "text-warning",
  met: "",
  breached: "text-destructive",
} as const satisfies Record<IncidentTargetTimerStatus, string>;

/** One timer as dot and mono phrase, "response due in 35m"; inherits size from its row. */
export function IncidentTargetBadge({
  timer,
  kind,
  now,
  size = "sm",
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  timer: IncidentTargetTimer;
  size?: keyof typeof dotSize;
  /** Prefix naming the timer; omit where a label already names it. */
  kind?: string;
  now: Date;
}) {
  return (
    <span
      data-slot="incident-target-badge"
      className={cn(
        // inline, not flex: a truncating row cuts the text, not the whole badge
        "font-mono whitespace-nowrap tabular-nums",
        tone[timer.status],
        className,
      )}
      {...props}
    >
      <StatusDot
        variant={variant[timer.status]}
        className={cn(dotSize[size], "align-middle")}
      />
      {kind ? <span data-slot="incident-target-kind">{kind} </span> : null}
      {slaTimerPhrase(timer, now)}
    </span>
  );
}
