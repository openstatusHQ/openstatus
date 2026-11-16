import { formatIncidentTargetMinutes } from "@openstatus/db/src/schema/incident_response_targets/events";
import type {
  IncidentTargetState,
  IncidentTargetTimer,
} from "@openstatus/db/src/schema/incident_response_targets/state";

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

import { IncidentTargetBadge } from "./incident-target-badge";

function TimerProperty({
  label,
  timer,
  now,
}: {
  label: string;
  timer: IncidentTargetTimer;
  now: Date;
}) {
  return (
    <Property>
      <PropertyLabel>{label}</PropertyLabel>
      <PropertyValue>
        <HoverCardTimestamp date={timer.metAt ?? timer.dueAt} side="left">
          <IncidentTargetBadge
            timer={timer}
            now={now}
            size="md"
            className="truncate"
          />
        </HoverCardTimestamp>
        <PropertyMeta>
          {formatIncidentTargetMinutes(timer.targetMinutes)}
        </PropertyMeta>
      </PropertyValue>
    </Property>
  );
}

export function IncidentTarget({
  state,
  now,
}: {
  state: IncidentTargetState;
  now: Date;
}) {
  const hasTargets = state.response || state.resolution;
  return (
    <PropertyList>
      {state.response ? (
        <TimerProperty label="Response" timer={state.response} now={now} />
      ) : null}
      {state.resolution ? (
        <TimerProperty label="Resolution" timer={state.resolution} now={now} />
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
