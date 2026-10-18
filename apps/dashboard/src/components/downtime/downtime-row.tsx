"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { StatusBadge } from "@/components/common/status-badge";
import {
  EventListActions,
  EventListContent,
  EventListDescription,
  EventListItem,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { IncidentRowActions } from "@/components/data-table/incidents/data-table-row-actions";
import { DeclareFromRow } from "@/components/incidents/declare-from-row";

import { DowntimeNextAction } from "./downtime-next-action";

type Downtime = RouterOutputs["monitorIncident"]["list"][number];

/**
 * On a monitor's own page the duration is the title; `monitor` titles the
 * row with the monitor instead, for lists across monitors.
 */
export function DowntimeRow({
  downtime,
  monitor = false,
}: {
  downtime: Downtime;
  monitor?: boolean;
}) {
  const ongoing = downtime.resolvedAt === null;
  const duration = formatDistanceStrict(
    downtime.startedAt,
    downtime.resolvedAt ?? new Date(),
  );
  return (
    <EventListItem>
      <EventListContent>
        {monitor ? (
          <EventListTitle asChild>
            <NextLink href={`/monitors/${downtime.monitor.id}/incidents`}>
              {downtime.monitor.name}
            </NextLink>
          </EventListTitle>
        ) : (
          <EventListTitle>Down for {duration}</EventListTitle>
        )}
        <EventListDescription>
          {monitor ? <span>Downtime</span> : null}
          {ongoing ? (
            <StatusBadge variant="destructive" plain>
              Ongoing
            </StatusBadge>
          ) : null}
          {monitor ? (
            <span>
              {ongoing ? "for" : "lasted"} {duration}
            </span>
          ) : null}
          {downtime.acknowledgedAt ? (
            <span>
              Acknowledged after{" "}
              {formatDistanceStrict(
                downtime.startedAt,
                downtime.acknowledgedAt,
              )}
            </span>
          ) : ongoing ? (
            <span>Not acknowledged</span>
          ) : null}
          {ongoing ? null : downtime.autoResolved ? (
            <span>Recovered automatically</span>
          ) : (
            <span>Resolved manually</span>
          )}
        </EventListDescription>
      </EventListContent>
      <EventListTime date={downtime.startedAt} />
      <EventListActions>
        {ongoing ? (
          <>
            <DowntimeNextAction incident={downtime} />
            <DeclareFromRow
              title={`${downtime.monitor.name} is down`}
              startedAt={downtime.startedAt}
              source={{ type: "monitor_incident", id: downtime.id }}
            />
          </>
        ) : null}
        <IncidentRowActions incident={downtime} />
      </EventListActions>
    </EventListItem>
  );
}
