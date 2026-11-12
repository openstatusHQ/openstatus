import type {
  IncidentSlaTimer,
  IncidentSlaTimerStatus,
} from "@openstatus/db/src/schema/incident_sla_policies/state";
import { cn } from "@openstatus/ui/lib/utils";

import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
import { slaTimerPhrase } from "@/data/incident-sla.client";

const variant = {
  running: "default",
  at_risk: "warning",
  met: "success",
  breached: "destructive",
} as const satisfies Record<IncidentSlaTimerStatus, StatusVariant>;

const tone = {
  running: "",
  at_risk: "text-warning",
  met: "",
  breached: "text-destructive",
} as const satisfies Record<IncidentSlaTimerStatus, string>;

/** One timer as dot and mono phrase, "response due in 35m"; inherits size from its row. */
export function IncidentSlaBadge({
  timer,
  kind,
  now,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  timer: IncidentSlaTimer;
  /** Prefix naming the timer; omit where a label already names it. */
  kind?: string;
  now: Date;
}) {
  return (
    <span
      data-slot="incident-sla-badge"
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
        className="mr-1.5 mb-px size-1.5 align-middle"
      />
      {kind ? <span data-slot="incident-sla-kind">{kind} </span> : null}
      {slaTimerPhrase(timer, now)}
    </span>
  );
}
