import type { IncidentUpdateCadence } from "@openstatus/db/src/schema/incident_sla_policies/cadence";
import { formatIncidentSlaMinutes } from "@openstatus/db/src/schema/incident_sla_policies/events";
import type {
  IncidentSlaState,
  IncidentSlaTimer,
  IncidentSlaTimerKind,
} from "@openstatus/db/src/schema/incident_sla_policies/state";
import { format } from "date-fns";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { Link } from "@/components/common/link";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";

import { IncidentSlaBadge, IncidentUpdateBadge } from "./incident-sla-badge";
import { IncidentSlaMissReason } from "./incident-sla-miss-reason";

function TimerProperty({
  incidentId,
  kind,
  label,
  timer,
  now,
}: {
  incidentId: number;
  kind: IncidentSlaTimerKind;
  label: string;
  timer: IncidentSlaTimer;
  now: Date;
}) {
  return (
    <Property>
      <PropertyLabel>{label}</PropertyLabel>
      <PropertyValue className="flex-col items-start gap-0.5 py-1.5">
        <IncidentSlaBadge timer={timer} now={now} />
        <span className="text-muted-foreground text-xs">
          {formatIncidentSlaMinutes(timer.targetMinutes)} target
          {timer.metAt ? null : (
            <>
              {" · "}
              <HoverCardTimestamp date={timer.dueAt} side="left">
                <span>{format(timer.dueAt, "HH:mm")}</span>
              </HoverCardTimestamp>
            </>
          )}
        </span>
        {timer.breachDueAt ? (
          <IncidentSlaMissReason
            incidentId={incidentId}
            kind={kind}
            reason={timer.missReason}
          />
        ) : null}
      </PropertyValue>
    </Property>
  );
}

function CadenceProperty({
  cadence,
  now,
}: {
  cadence: IncidentUpdateCadence;
  now: Date;
}) {
  return (
    <Property>
      <PropertyLabel>Next update</PropertyLabel>
      <PropertyValue className="flex-col items-start gap-0.5 py-1.5">
        <IncidentUpdateBadge cadence={cadence} now={now} />
        <span className="text-muted-foreground text-xs">
          every {formatIncidentSlaMinutes(cadence.intervalMinutes)}
          {" · "}
          <HoverCardTimestamp date={cadence.dueAt} side="left">
            <span>{format(cadence.dueAt, "HH:mm")}</span>
          </HoverCardTimestamp>
        </span>
      </PropertyValue>
    </Property>
  );
}

/** Aside block: both timers, the update cadence and the resolution stop, against the reporting fixed at declare. */
export function IncidentSla({
  incidentId,
  state,
  cadence,
  now,
}: {
  incidentId: number;
  state: IncidentSlaState;
  cadence: IncidentUpdateCadence | null;
  now: Date;
}) {
  return (
    <div className="flex flex-col gap-1">
      <PropertyList>
        {state.response ? (
          <TimerProperty
            incidentId={incidentId}
            kind="response"
            label="Response"
            timer={state.response}
            now={now}
          />
        ) : null}
        {state.resolution ? (
          <TimerProperty
            incidentId={incidentId}
            kind="resolution"
            label="Resolution"
            timer={state.resolution}
            now={now}
          />
        ) : null}
        {cadence ? <CadenceProperty cadence={cadence} now={now} /> : null}
      </PropertyList>
      <p className="text-muted-foreground pt-1 text-xs">
        {state.response || state.resolution || cadence
          ? null
          : "No targets for this severity. "}
        {state.responseMet === "status_report"
          ? "Response is met by the first status report update. "
          : null}
        Resolution stops at{" "}
        <span className="text-foreground">{state.resolutionStop}</span>. Targets
        were fixed when the incident was declared.{" "}
        <Link href="/reportings/incidents">Edit reporting</Link>
      </p>
    </div>
  );
}
