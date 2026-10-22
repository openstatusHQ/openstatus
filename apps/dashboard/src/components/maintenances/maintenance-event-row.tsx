"use client";

import type { RouterOutputs } from "@openstatus/api";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { DateBlock } from "@/components/common/date-block";
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
import {
  formatDurationShort,
  formatEventWindow,
} from "@/data/event-list.client";
import { maintenanceStatusConfig } from "@/data/overview-events.client";

import { useMaintenanceStatus } from "./use-maintenance-status";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

/**
 * `type` is for lists that mix event kinds: a type tag leads and the
 * sentence is the state and the window.
 */
export function MaintenanceEventRow({
  maintenance,
  type = false,
}: {
  maintenance: Maintenance;
  type?: boolean;
}) {
  const status = useMaintenanceStatus(maintenance);
  const config = maintenanceStatusConfig[status];
  const completed = status === "completed";
  return (
    <EventListItem
      className={type ? "[--event-list-media:2.75rem]" : undefined}
    >
      <EventListMedia>
        {type ? (
          <TypeTag
            label="Maintenance"
            variant={completed ? "default" : config.variant}
          >
            MNT
          </TypeTag>
        ) : (
          <DateBlock date={maintenance.from} variant="info" />
        )}
      </EventListMedia>
      <EventListContent>
        <EventListTitle asChild>
          <NextLink
            href={`/status-pages/${maintenance.pageId}/maintenances/${maintenance.id}`}
          >
            {maintenance.title}
          </NextLink>
        </EventListTitle>
        <EventListDescription>
          {type ? (
            <span className={cn(!completed && "text-foreground font-medium")}>
              {config.label}
            </span>
          ) : completed ? (
            // the window leaves the sentence on lg, so name the state there
            <span className="hidden lg:inline">{config.label}</span>
          ) : (
            <StatusBadge variant={config.variant} plain>
              {config.label}
            </StatusBadge>
          )}
          <span className="lg:hidden">
            {formatDistanceStrict(maintenance.from, maintenance.to)} window
          </span>
          {type ? (
            <EventListTime date={maintenance.from} className="hidden lg:inline">
              {formatEventWindow(maintenance.from, maintenance.to)}
            </EventListTime>
          ) : null}
          <EventListTime date={maintenance.from} className="lg:hidden" />
        </EventListDescription>
      </EventListContent>
      <EventListMeta>
        <EventListTime date={maintenance.from} />
        <EventListDetail>
          {formatDurationShort(
            maintenance.to.getTime() - maintenance.from.getTime(),
          )}{" "}
          window
        </EventListDetail>
      </EventListMeta>
    </EventListItem>
  );
}
