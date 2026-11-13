import type {
  IncidentUpdateCadence,
  IncidentUpdateCadenceStatus,
} from "@openstatus/db/src/schema/incident_sla_policies/cadence";
import type {
  IncidentSlaTimer,
  IncidentSlaTimerStatus,
} from "@openstatus/db/src/schema/incident_sla_policies/state";
import { cn } from "@openstatus/ui/lib/utils";

import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
import {
  slaTimerPhrase,
  updateCadencePhrase,
} from "@/data/incident-sla.client";

const variant = {
  running: "default",
  at_risk: "warning",
  met: "success",
  breached: "destructive",
} as const satisfies Record<IncidentSlaTimerStatus, StatusVariant>;

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
} as const satisfies Record<IncidentSlaTimerStatus, string>;

/** One timer as dot and mono phrase, "response due in 35m"; inherits size from its row. */
export function IncidentSlaBadge({
  timer,
  kind,
  now,
  size = "sm",
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  timer: IncidentSlaTimer;
  size?: keyof typeof dotSize;
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
        className={cn(dotSize[size], "align-middle")}
      />
      {kind ? <span data-slot="incident-sla-kind">{kind} </span> : null}
      {slaTimerPhrase(timer, now)}
    </span>
  );
}

const cadenceVariant = {
  running: "default",
  at_risk: "warning",
  overdue: "destructive",
} as const satisfies Record<IncidentUpdateCadenceStatus, StatusVariant>;

const cadenceTone = {
  running: "",
  at_risk: "text-warning",
  overdue: "text-destructive",
} as const satisfies Record<IncidentUpdateCadenceStatus, string>;

/** The update interval as dot and mono phrase, "update overdue by 45m". */
export function IncidentUpdateBadge({
  cadence,
  kind,
  now,
  size = "sm",
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  cadence: IncidentUpdateCadence;
  size?: keyof typeof dotSize;
  kind?: string;
  now: Date;
}) {
  return (
    <span
      data-slot="incident-update-badge"
      className={cn(
        "font-mono whitespace-nowrap tabular-nums",
        cadenceTone[cadence.status],
        className,
      )}
      {...props}
    >
      <StatusDot
        variant={cadenceVariant[cadence.status]}
        className={cn(dotSize[size], "align-middle")}
      />
      {kind ? <span data-slot="incident-sla-kind">{kind} </span> : null}
      {updateCadencePhrase(cadence, now)}
    </span>
  );
}
