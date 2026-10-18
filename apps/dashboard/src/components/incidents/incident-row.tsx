"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { SeverityBars } from "@/components/common/severity-bars";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EventListContent,
  EventListDetail,
  EventListDescription,
  EventListItem,
  EventListMedia,
  EventListMeta,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { formatDurationShort } from "@/data/event-list.client";
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
  const status = statusConfig[incident.status];
  const active = isIncidentActive(incident);
  const now = new Date();
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
          {active ? (
            <StatusBadge variant={status.variant} plain>
              {/* two variants: a split label would take the badge's flex gap as a word space */}
              <span className="lg:hidden">
                {status.label} for{" "}
                {formatDistanceStrict(incident.startedAt, now)}
              </span>
              <span className="hidden lg:inline">{status.label}</span>
            </StatusBadge>
          ) : endedAt && incident.status === "resolved" ? (
            <span>
              Resolved
              <span className="lg:hidden">
                {" "}
                after {formatDistanceStrict(incident.startedAt, endedAt)}
              </span>
            </span>
          ) : (
            <span>{status.label}</span>
          )}
          <EventListTime date={incident.declaredAt} className="lg:hidden" />
        </EventListDescription>
      </EventListContent>
      <EventListMeta>
        <EventListTime date={incident.declaredAt} />
        {active || (endedAt && incident.status === "resolved") ? (
          <EventListDetail>
            {active ? "open" : "lasted"}{" "}
            {formatDurationShort(
              (active ? now : (endedAt ?? now)).getTime() -
                incident.startedAt.getTime(),
            )}
          </EventListDetail>
        ) : null}
      </EventListMeta>
    </EventListItem>
  );
}
