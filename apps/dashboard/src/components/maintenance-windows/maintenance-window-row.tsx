"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { MaintenanceWindowRowActions } from "@/components/data-table/maintenance-windows/data-table-row-actions";
import { FormSheetMaintenanceWindow } from "@/components/forms/maintenance-window/sheet";
import { useMaintenanceStatus } from "@/components/maintenances/use-maintenance-status";
import { maintenanceWindowModeLabels } from "@/data/maintenance-windows.client";
import { maintenanceStatusConfig } from "@/data/overview-events.client";
import {
  formatClockOrDay,
  formatDurationShort,
  formatWindow,
} from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

type MaintenanceWindow = RouterOutputs["maintenanceWindow"]["list"][number];

/** `kind` labels the row by type for a mixed list, like `MaintenanceRow`. */
export function MaintenanceWindowRow({
  window,
  monitors,
  currentMonitorId,
  kind = false,
}: {
  window: MaintenanceWindow;
  kind?: boolean;
  monitors: React.ComponentProps<typeof FormSheetMaintenanceWindow>["monitors"];
  /** left out of the monitor names, the page already says which */
  currentMonitorId?: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useMaintenanceStatus(window);
  const [editOpen, setEditOpen] = useState(false);
  const updateMutation = useMutation(
    trpc.maintenanceWindow.update.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.maintenanceWindow.list.queryKey(),
        }),
    }),
  );
  const now = new Date();
  const { from, to } = window;
  const others = window.monitors.filter((m) => m.id !== currentMonitorId);
  const meta = [
    status === "scheduled"
      ? `in ${formatDurationShort(from.getTime() - now.getTime())}`
      : status === "in-progress"
        ? `until ${formatClockOrDay(to, now)}`
        : formatWindow(from, to),
    maintenanceWindowModeLabels[window.mode],
    others.length
      ? `${currentMonitorId ? "also " : ""}${others.map((m) => m.name).join(", ")}`
      : null,
  ].filter((item) => item !== null);

  return (
    <EventRow>
      <EventRowDate date={from} />
      <EventRowStatus>
        <StatusDot
          variant={kind ? "info" : maintenanceStatusConfig[status].variant}
        />
        <span>{kind ? "Window" : maintenanceStatusConfig[status].label}</span>
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle>{window.title}</EventRowTitle>
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
      <EventRowActor actor={window.createdByUser} label="Created by" optional />
      <EventRowDuration>
        {formatDurationShort(to.getTime() - from.getTime())}
      </EventRowDuration>
      <EventRowMenu>
        <MaintenanceWindowRowActions
          window={window}
          onEdit={() => setEditOpen(true)}
        />
      </EventRowMenu>
      <FormSheetMaintenanceWindow
        open={editOpen}
        onOpenChange={setEditOpen}
        monitors={monitors}
        defaultValues={{
          title: window.title,
          mode: window.mode,
          from: window.from,
          to: window.to,
          monitorIds: window.monitorIds,
        }}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync({ id: window.id, ...values });
        }}
      />
    </EventRow>
  );
}
