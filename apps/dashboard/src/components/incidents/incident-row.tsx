"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { SeverityBars } from "@/components/common/severity-bars";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EventListContent,
  EventListDescription,
  EventListItem,
  EventListMedia,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import {
  incidentEndedAt,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";

type Incident = NonNullable<RouterOutputs["incident"]["list"]>[number];

const severityLevel = { critical: 3, major: 2, minor: 1 } as const;

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
  const severity = severityConfig[incident.severity];
  return (
    <EventListItem>
      <EventListMedia>
        <SeverityBars
          level={severityLevel[incident.severity]}
          // a canceled incident never had its impact, so it stays neutral
          variant={
            incident.status === "canceled" ? "default" : severity.variant
          }
          label={`${severity.label} severity`}
        />
      </EventListMedia>
      <EventListContent>
        <EventListTitle asChild>
          <NextLink href={`/incidents/${incident.id}`}>
            {incident.title}
          </NextLink>
        </EventListTitle>
        <EventListDescription>
          {type ? <span>Incident</span> : null}
          <span>{severity.label}</span>
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
