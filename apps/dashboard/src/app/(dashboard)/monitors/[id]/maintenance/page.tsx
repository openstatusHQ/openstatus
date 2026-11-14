"use client";

import { Maintenance } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventGroup,
  EventGroupCount,
  EventGroupHeader,
  EventGroupTitle,
} from "@/components/content/event-group";
import { EventList, EventListMore } from "@/components/content/event-list";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { FormSheetMaintenanceWindow } from "@/components/forms/maintenance-window/sheet";
import { MaintenanceWindowRow } from "@/components/maintenance-windows/maintenance-window-row";
import { useMaintenanceTick } from "@/components/maintenances/use-maintenance-status";
import { getMaintenanceStatus } from "@/data/overview-events.client";
import { usePaged } from "@/hooks/use-paged";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const monitorId = Number.parseInt(id);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const { data: windows } = useQuery(
    trpc.maintenanceWindow.list.queryOptions({ monitorId }),
  );
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const createMutation = useMutation(
    trpc.maintenanceWindow.create.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.maintenanceWindow.list.queryKey(),
        }),
    }),
  );

  useMaintenanceTick(windows ?? []);
  const now = new Date();
  const current = (windows ?? [])
    .filter((w) => getMaintenanceStatus(w, now) !== "completed")
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const past = (windows ?? []).filter(
    (w) => getMaintenanceStatus(w, now) === "completed",
  );
  const paged = usePaged(past);

  if (!windows || !monitors) return null;

  const options = monitors.map((m) => ({ id: m.id, name: m.name, url: m.url }));
  const create = (
    <FormSheetMaintenanceWindow
      open={openCreate}
      onOpenChange={setOpenCreate}
      monitors={options}
      defaultValues={{ monitorIds: [monitorId] }}
      onSubmit={async (values) => {
        await createMutation.mutateAsync(values);
      }}
    >
      <Button data-section="action" size="sm">
        Create maintenance window
      </Button>
    </FormSheetMaintenanceWindow>
  );

  return (
    <SectionGroup>
      <Section id="maintenance-windows">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Maintenance windows</SectionTitle>
            <SectionDescription>
              Planned work on this monitor. Internal only: announce it on a
              status page with a maintenance there.
            </SectionDescription>
          </SectionHeader>
          <div>{create}</div>
        </SectionHeaderRow>
        {windows.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateMedia>
              <Maintenance />
            </EmptyStateMedia>
            <EmptyStateTitle>No maintenance windows</EmptyStateTitle>
            <EmptyStateDescription>
              Pause checks during planned work, or keep checking without status
              changes and alerts.
            </EmptyStateDescription>
            <EmptyStateActions>
              <Button size="sm" onClick={() => setOpenCreate(true)}>
                Create maintenance window
              </Button>
            </EmptyStateActions>
          </EmptyStateContainer>
        ) : (
          <div className="flex flex-col gap-6">
            <EventGroup>
              <EventGroupHeader>
                <EventGroupTitle>
                  Active and scheduled
                  <EventGroupCount>{current.length}</EventGroupCount>
                </EventGroupTitle>
              </EventGroupHeader>
              <EventList>
                {current.map((w) => (
                  <MaintenanceWindowRow
                    key={w.id}
                    window={w}
                    monitors={options}
                    currentMonitorId={monitorId}
                  />
                ))}
              </EventList>
            </EventGroup>
            <EventGroup>
              <EventGroupHeader>
                <EventGroupTitle>
                  Past
                  <EventGroupCount>{past.length}</EventGroupCount>
                </EventGroupTitle>
              </EventGroupHeader>
              <EventList>
                {paged.visible.map((w) => (
                  <MaintenanceWindowRow
                    key={w.id}
                    window={w}
                    monitors={options}
                    currentMonitorId={monitorId}
                  />
                ))}
                {paged.hasMore ? (
                  <EventListMore onClick={paged.showMore}>
                    Show older
                  </EventListMore>
                ) : null}
              </EventList>
            </EventGroup>
          </div>
        )}
      </Section>
    </SectionGroup>
  );
}
