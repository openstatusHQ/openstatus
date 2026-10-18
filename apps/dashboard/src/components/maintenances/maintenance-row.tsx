"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { DateBlock } from "@/components/common/date-block";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EventListContent,
  EventListDescription,
  EventListItem,
  EventListMedia,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { maintenanceStatusConfig } from "@/data/overview-events.client";

import { useMaintenanceStatus } from "./use-maintenance-status";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

/** `type` prefixes the sentence with "Maintenance", for lists that mix event kinds. */
export function MaintenanceRow({
  maintenance,
  type = false,
}: {
  maintenance: Maintenance;
  type?: boolean;
}) {
  const status = useMaintenanceStatus(maintenance);
  const config = maintenanceStatusConfig[status];
  return (
    <EventListItem>
      <EventListMedia>
        <DateBlock date={maintenance.from} variant="info" />
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
          {type ? <span>Maintenance</span> : null}
          {status === "completed" ? null : (
            <StatusBadge variant={config.variant} plain>
              {config.label}
            </StatusBadge>
          )}
          <span>
            {formatDistanceStrict(maintenance.from, maintenance.to)} window
          </span>
          <EventListTime date={maintenance.from} />
        </EventListDescription>
      </EventListContent>
    </EventListItem>
  );
}
