"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { DateBlock } from "@/components/common/date-block";
import { StatusBadge } from "@/components/common/status-badge";
import { TypeTag } from "@/components/common/type-tag";
import {
  EventListActions,
  EventListContent,
  EventListDescription,
  EventListDetail,
  EventListItem,
  EventListMedia,
  EventListMeta,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { IncidentRowActions } from "@/components/data-table/incidents/data-table-row-actions";
import { DeclareFromRow } from "@/components/incidents/declare-from-row";
import { formatDurationShort, formatEventDate } from "@/data/event-list.client";

import { DowntimeNextAction } from "./downtime-next-action";

type Downtime = RouterOutputs["monitorIncident"]["list"][number];

/**
 * On a monitor's own page the duration is the title. `monitor` is for lists
 * across monitors and kinds: it titles the row with the monitor, leads with a
 * type tag and makes the sentence the state and the date.
 */
export function DowntimeRow({
  downtime,
  monitor = false,
}: {
  downtime: Downtime;
  monitor?: boolean;
}) {
  const ongoing = downtime.resolvedAt === null;
  const state = ongoing
    ? downtime.acknowledgedAt
      ? "Acknowledged"
      : "Ongoing"
    : downtime.autoResolved
      ? "Recovered"
      : "Resolved";
  // legacy monitors can have an empty name; the title is the row's only link
  const monitorName = downtime.monitor.name || downtime.monitor.url;
  const duration = formatDistanceStrict(
    downtime.startedAt,
    downtime.resolvedAt ?? new Date(),
  );
  return (
    <EventListItem
      className={monitor ? "[--event-list-media:2.75rem]" : undefined}
    >
      <EventListMedia>
        {monitor ? (
          <TypeTag
            label="Downtime"
            variant={
              ongoing
                ? downtime.acknowledgedAt
                  ? "warning"
                  : "destructive"
                : "default"
            }
          >
            DWN
          </TypeTag>
        ) : (
          <DateBlock date={downtime.startedAt} variant="destructive" />
        )}
      </EventListMedia>
      <EventListContent>
        {monitor ? (
          <EventListTitle asChild>
            <NextLink href={`/monitors/${downtime.monitor.id}/incidents`}>
              {monitorName}
            </NextLink>
          </EventListTitle>
        ) : (
          <EventListTitle>Down for {duration}</EventListTitle>
        )}
        <EventListDescription>
          {ongoing && monitor ? (
            <span className="text-foreground font-medium">{state}</span>
          ) : ongoing ? (
            <StatusBadge variant="destructive" plain>
              {state}
            </StatusBadge>
          ) : (
            <span>
              {state}
              {monitor ? (
                <span className="lg:hidden"> after {duration}</span>
              ) : null}
            </span>
          )}
          {monitor ? (
            <EventListTime
              date={downtime.startedAt}
              className="hidden lg:inline"
            >
              {formatEventDate(downtime.startedAt)}
            </EventListTime>
          ) : null}
          <EventListTime date={downtime.startedAt} className="lg:hidden" />
        </EventListDescription>
      </EventListContent>
      {ongoing ? (
        <EventListActions>
          <DowntimeNextAction incident={downtime} />
          <DeclareFromRow
            title={`${monitorName} is down`}
            startedAt={downtime.startedAt}
            source={{ type: "monitor_incident", id: downtime.id }}
          />
        </EventListActions>
      ) : monitor ? null : (
        // no detail page to delete it from, so the menu stays here
        <EventListActions>
          <IncidentRowActions incident={downtime} />
        </EventListActions>
      )}
      <EventListMeta>
        <EventListTime date={downtime.startedAt} />
        <EventListDetail>
          {ongoing ? "down" : "lasted"}{" "}
          {formatDurationShort(
            (downtime.resolvedAt ?? new Date()).getTime() -
              downtime.startedAt.getTime(),
          )}
        </EventListDetail>
      </EventListMeta>
    </EventListItem>
  );
}
