"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { StatusBadge } from "@/components/common/status-badge";
import {
  EventListContent,
  EventListDescription,
  EventListItem,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { incidentEndedAt, statusConfig } from "@/data/managed-incidents.client";

import { IncidentSeverityBadge } from "./incident-badge";

type Incident = NonNullable<RouterOutputs["incident"]["list"]>[number];

export function isIncidentActive(incident: Pick<Incident, "status">) {
  return incident.status === "open" || incident.status === "mitigated";
}

/** `type` prefixes the sentence with "Incident", for lists that mix event kinds. */
export function IncidentRow({
  incident,
  type = false,
}: {
  incident: Incident;
  type?: boolean;
}) {
  const endedAt = incidentEndedAt(incident);
  return (
    <EventListItem>
      <EventListContent>
        <EventListTitle asChild>
          <NextLink href={`/incidents/${incident.id}`}>
            {incident.title}
          </NextLink>
        </EventListTitle>
        <EventListDescription>
          {type ? <span>Incident</span> : null}
          <IncidentSeverityBadge severity={incident.severity} plain />
          {isIncidentActive(incident) ? (
            <StatusBadge variant={statusConfig[incident.status].variant} plain>
              {statusConfig[incident.status].label} for{" "}
              {formatDistanceStrict(incident.startedAt, new Date())}
            </StatusBadge>
          ) : incident.status === "canceled" ? (
            <span>Canceled</span>
          ) : endedAt ? (
            <span>
              Resolved after {formatDistanceStrict(incident.startedAt, endedAt)}
            </span>
          ) : (
            <span>Resolved</span>
          )}
          {incident.commander ? (
            <span>
              Commander{" "}
              <span className="text-foreground">
                {incident.commander.name ?? incident.commander.email}
              </span>
            </span>
          ) : null}
          {incident.statusReport ? (
            <span className="min-w-0 truncate">
              Report{" "}
              <span className="text-foreground">
                {incident.statusReport.title}
              </span>
            </span>
          ) : null}
        </EventListDescription>
      </EventListContent>
      <EventListTime date={incident.declaredAt} />
    </EventListItem>
  );
}
