"use client";

import type { RouterOutputs } from "@openstatus/api";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { SeverityBars } from "@/components/common/severity-bars";
import { StatusBadge } from "@/components/common/status-badge";
import { TypeTag } from "@/components/common/type-tag";
import {
  EventListContent,
  EventListDescription,
  EventListDetail,
  EventListItem,
  EventListMedia,
  EventListMeta,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { formatDurationShort, formatEventDate } from "@/data/event-list.client";
import {
  incidentEndedAt,
  isIncidentActive,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";

type Incident = NonNullable<RouterOutputs["incident"]["list"]>[number];

const severityLevel = { critical: 3, major: 2, minor: 1 } as const;

/**
 * `type` is for lists that mix event kinds: a type tag leads and the
 * sentence is the state and the date.
 */
export function IncidentEventRow({
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
  const resolved = endedAt && incident.status === "resolved";
  const now = new Date();
  return (
    <EventListItem
      className={type ? "[--event-list-media:2.75rem]" : undefined}
    >
      <EventListMedia>
        {type ? (
          <TypeTag
            label="Incident"
            variant={active ? status.variant : "default"}
          >
            INC
          </TypeTag>
        ) : (
          <SeverityBars
            level={severityLevel[incident.severity]}
            // a canceled incident never had its impact, so it stays neutral
            variant={
              incident.status === "canceled" ? "default" : severity.variant
            }
            label={`${severity.label} severity`}
          />
        )}
      </EventListMedia>
      <EventListContent>
        <EventListTitle asChild>
          <NextLink href={`/incidents/${incident.id}`}>
            {incident.title}
          </NextLink>
        </EventListTitle>
        <EventListDescription>
          {active && !type ? (
            <StatusBadge variant={status.variant} plain>
              {/* two variants: a split label would take the badge's flex gap as a word space */}
              <span className="lg:hidden">
                {status.label} for{" "}
                {formatDistanceStrict(incident.startedAt, now)}
              </span>
              <span className="hidden lg:inline">{status.label}</span>
            </StatusBadge>
          ) : (
            <span className={cn(active && "text-foreground font-medium")}>
              {status.label}
              {active ? (
                <span className="lg:hidden">
                  {" "}
                  for {formatDistanceStrict(incident.startedAt, now)}
                </span>
              ) : resolved ? (
                <span className="lg:hidden">
                  {" "}
                  after {formatDistanceStrict(incident.startedAt, endedAt)}
                </span>
              ) : null}
            </span>
          )}
          {type ? (
            <EventListTime
              date={incident.declaredAt}
              className="hidden lg:inline"
            >
              {formatEventDate(incident.declaredAt)}
            </EventListTime>
          ) : null}
          <EventListTime date={incident.declaredAt} className="lg:hidden" />
        </EventListDescription>
      </EventListContent>
      <EventListMeta>
        <EventListTime date={incident.declaredAt} />
        {active || resolved ? (
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
