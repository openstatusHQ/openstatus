import type { IncidentUpdateCadence } from "@openstatus/db/src/schema/incident_sla_policies/cadence";
import { formatIncidentSlaMinutes } from "@openstatus/db/src/schema/incident_sla_policies/events";
import type {
  IncidentSlaState,
  IncidentSlaTimer,
  IncidentSlaTimerKind,
} from "@openstatus/db/src/schema/incident_sla_policies/state";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { StatusDot } from "@/components/common/status-dot";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyMeta,
  PropertyValue,
} from "@/components/content/property-list";
import { statusConfig } from "@/data/managed-incidents.client";

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
    <>
      <Property>
        <PropertyLabel>{label}</PropertyLabel>
        <PropertyValue>
          <HoverCardTimestamp date={timer.metAt ?? timer.dueAt} side="left">
            <IncidentSlaBadge
              timer={timer}
              now={now}
              size="md"
              className="truncate"
            />
          </HoverCardTimestamp>
          <PropertyMeta>
            {formatIncidentSlaMinutes(timer.targetMinutes)}
          </PropertyMeta>
        </PropertyValue>
      </Property>
      {timer.breachDueAt ? (
        <IncidentSlaMissReason
          incidentId={incidentId}
          kind={kind}
          reason={timer.missReason}
        />
      ) : null}
    </>
  );
}

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
  const hasTargets = state.response || state.resolution || cadence;
  return (
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
      {cadence ? (
        <Property>
          <PropertyLabel>Next update</PropertyLabel>
          <PropertyValue>
            <HoverCardTimestamp date={cadence.dueAt} side="left">
              <IncidentUpdateBadge
                cadence={cadence}
                now={now}
                size="md"
                className="truncate"
              />
            </HoverCardTimestamp>
            <PropertyMeta>
              every {formatIncidentSlaMinutes(cadence.intervalMinutes)}
            </PropertyMeta>
          </PropertyValue>
        </Property>
      ) : null}
      {hasTargets ? null : (
        <Property>
          <PropertyLabel>Targets</PropertyLabel>
          <PropertyValue className="text-muted-foreground">
            None for this severity
          </PropertyValue>
        </Property>
      )}
      {state.response && state.responseMet === "status_report" ? (
        <Property>
          <PropertyLabel>Response by</PropertyLabel>
          <PropertyValue>First report update</PropertyValue>
        </Property>
      ) : null}
      {/* frozen at declare: later policy edits don't apply here */}
      <Property>
        <PropertyLabel>Stops at</PropertyLabel>
        <PropertyValue>
          <StatusDot variant={statusConfig[state.resolutionStop].variant} />
          {statusConfig[state.resolutionStop].label}
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
