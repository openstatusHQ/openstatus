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

export function MaintenanceWindowRow({
  window,
  monitors,
}: {
  window: MaintenanceWindow;
  monitors: React.ComponentProps<typeof FormSheetMaintenanceWindow>["monitors"];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useMaintenanceStatus(window);
  const [editOpen, setEditOpen] = useState(false);
  const updateMutation = useMutation(
    trpc.maintenanceWindow.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.maintenanceWindow.list.queryKey(),
        });
        // each monitor carries its maintenance state
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
      },
    }),
  );
  const now = new Date();
  const { from, to } = window;
  const meta = [
    status === "scheduled"
      ? `in ${formatDurationShort(from.getTime() - now.getTime())}`
      : status === "in-progress"
        ? `until ${formatClockOrDay(to, now)}`
        : formatWindow(from, to),
    maintenanceWindowModeLabels[window.mode],
    window.monitors.length
      ? window.monitors.map((m) => m.name).join(", ")
      : null,
  ].filter((item) => item !== null);

  return (
    <EventRow>
      <EventRowDate date={from} />
      <EventRowStatus>
        <StatusDot variant={maintenanceStatusConfig[status].variant} />
        <span>{maintenanceStatusConfig[status].label}</span>
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle>{window.title}</EventRowTitle>
        <EventRowMeta>
          {meta.map((item, i) => (
            <span key={i}>{item}</span>
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
