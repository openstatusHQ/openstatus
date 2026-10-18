"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import NextLink from "next/link";

import { DateBlock } from "@/components/common/date-block";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EventListActions,
  EventListContent,
  EventListDescription,
  EventListItem,
  EventListMedia,
  EventListTime,
  EventListTitle,
} from "@/components/content/event-list";
import { MaintenanceRowActions } from "@/components/data-table/maintenances/data-table-row-actions";
import { listNames } from "@/data/event-list.client";
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
          <span className="min-w-0 truncate">
            {maintenance.pageComponents.length > 0
              ? listNames(maintenance.pageComponents.map((c) => c.name))
              : "No components"}
          </span>
        </EventListDescription>
      </EventListContent>
      <EventListTime date={maintenance.from} />
      <EventListActions>
        <MaintenanceRowActions maintenance={maintenance} />
      </EventListActions>
    </EventListItem>
  );
}
