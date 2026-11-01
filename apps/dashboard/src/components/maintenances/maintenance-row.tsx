"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import { StatusDot } from "@/components/common/status-dot";
import {
  EventRow,
  EventRowActions,
  EventRowActor,
  EventRowContent,
  EventRowDate,
  EventRowDuration,
  EventRowMenu,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import { MaintenanceRowActions } from "@/components/data-table/maintenances/data-table-row-actions";
import { maintenanceStatusConfig } from "@/data/overview-events.client";
import {
  formatClockOrDay,
  formatDurationShort,
  formatWindow,
} from "@/lib/formatter";

import { MaintenanceEditSheet } from "./maintenance-edit-sheet";
import { useMaintenanceStatus } from "./use-maintenance-status";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

/** `kind` labels the row by type for a mixed list, with the maintenance blue of the activity lanes. */
export function MaintenanceRow({
  maintenance,
  kind = false,
}: {
  maintenance: Maintenance;
  kind?: boolean;
}) {
  const status = useMaintenanceStatus(maintenance);
  const [editOpen, setEditOpen] = useState(false);
  const now = new Date();
  const { from, to } = maintenance;
  const meta =
    status === "scheduled"
      ? [
          formatWindow(from, to),
          `in ${formatDurationShort(from.getTime() - now.getTime())}`,
        ]
      : status === "in-progress"
        ? ["in progress", `until ${formatClockOrDay(to, now)}`]
        : [formatWindow(from, to)];

  return (
    <EventRow>
      <EventRowDate date={from} />
      <EventRowStatus>
        <StatusDot
          variant={kind ? "info" : maintenanceStatusConfig[status].variant}
        />
        <span>
          {kind ? "Maintenance" : maintenanceStatusConfig[status].label}
        </span>
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle
          href={
            maintenance.pageId
              ? `/status-pages/${maintenance.pageId}/maintenances/${maintenance.id}`
              : undefined
          }
        >
          {maintenance.title}
        </EventRowTitle>
        <EventRowMeta>
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </EventRowMeta>
      </EventRowContent>
      <EventRowActions>
        {status === "completed" ? null : (
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        )}
      </EventRowActions>
      <EventRowActor
        actor={maintenance.createdByUser}
        label="Created by"
        optional
      />
      <EventRowDuration>
        {formatDurationShort(to.getTime() - from.getTime())}
      </EventRowDuration>
      <EventRowMenu>
        <MaintenanceRowActions
          maintenance={maintenance}
          onEdit={() => setEditOpen(true)}
        />
      </EventRowMenu>
      <MaintenanceEditSheet
        maintenance={maintenance}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </EventRow>
  );
}
