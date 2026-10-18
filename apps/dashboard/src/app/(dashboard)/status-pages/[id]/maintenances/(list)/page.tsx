"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventList,
  EventListGroup,
  EventListGroupHeader,
  EventListGroupSummary,
  EventListGroupTitle,
  EventListGroups,
  EventListMore,
} from "@/components/content/event-list";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { MaintenanceRow } from "@/components/maintenances/maintenance-row";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { groupByMonth, pluralize } from "@/data/event-list.client";
import { useShowMore } from "@/hooks/use-show-more";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: maintenances, refetch } = useQuery(
    trpc.maintenance.list.queryOptions({
      pageId: Number.parseInt(id),
    }),
  );
  const sendMaintenanceUpdateMutation = useMutation(
    trpc.subscriberNotification.maintenance.mutationOptions({
      onError: (error) => {
        toast.error(errorMessage(error, "Failed to notify subscribers"));
      },
    }),
  );
  const createMaintenanceMutation = useMutation(
    trpc.maintenance.new.mutationOptions({
      onSuccess: (maintenance) => {
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
        if (maintenance.notifySubscribers) {
          sendMaintenanceUpdateMutation.mutate({
            id: maintenance.initialUpdateId,
          });
        }
      },
    }),
  );

  const now = new Date();
  // soonest first; a window counts as upcoming until it ends
  const upcoming = (maintenances ?? [])
    .filter((m) => m.to >= now)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const completed = useShowMore(
    (maintenances ?? [])
      .filter((m) => m.to < now)
      .sort((a, b) => b.from.getTime() - a.from.getTime()),
  );
  const months = groupByMonth(completed.visible, (m) => m.from);

  if (!statusPage || !maintenances) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{statusPage.title}</SectionTitle>
            <SectionDescription>
              List of all maintenances. Looking for{" "}
              <Link href={`/status-pages/${id}/status-reports`}>
                status reports
              </Link>
              ?
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetMaintenance
              items={toCheckboxTreeItems(
                statusPage.pageComponents,
                statusPage.pageComponentGroups,
              )}
              onSubmit={async (values) => {
                await createMaintenanceMutation.mutateAsync({
                  pageId: Number.parseInt(id),
                  title: values.title,
                  message: values.message ?? "",
                  startDate: values.startDate,
                  endDate: values.endDate,
                  pageComponents: values.pageComponents,
                  notifySubscribers: values.notifySubscribers,
                });
              }}
            >
              <Button data-section="action" size="sm">
                Create Maintenance
              </Button>
            </FormSheetMaintenance>
          </div>
        </SectionHeaderRow>
        {maintenances.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No maintenances</EmptyStateTitle>
            <EmptyStateDescription>
              Schedule a maintenance to let your users know about planned
              downtime ahead of time.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <EventListGroups>
            {upcoming.length > 0 ? (
              <EventListGroup aria-labelledby="maintenances-upcoming">
                <EventListGroupHeader>
                  <EventListGroupTitle id="maintenances-upcoming">
                    Upcoming
                  </EventListGroupTitle>
                  <EventListGroupSummary>
                    {pluralize(upcoming.length, "maintenance")}
                  </EventListGroupSummary>
                </EventListGroupHeader>
                <EventList>
                  {upcoming.map((maintenance) => (
                    <MaintenanceRow
                      key={maintenance.id}
                      maintenance={maintenance}
                    />
                  ))}
                </EventList>
              </EventListGroup>
            ) : null}
            {months.map((month) => (
              <EventListGroup
                key={month.key}
                aria-labelledby={`maintenances-${month.key}`}
              >
                <EventListGroupHeader>
                  <EventListGroupTitle id={`maintenances-${month.key}`}>
                    {month.label}
                  </EventListGroupTitle>
                  <EventListGroupSummary>
                    {pluralize(month.items.length, "maintenance")}
                  </EventListGroupSummary>
                </EventListGroupHeader>
                <EventList>
                  {month.items.map((maintenance) => (
                    <MaintenanceRow
                      key={maintenance.id}
                      maintenance={maintenance}
                    />
                  ))}
                </EventList>
              </EventListGroup>
            ))}
            {completed.hasMore ? (
              <EventListMore onClick={completed.showMore} />
            ) : null}
          </EventListGroups>
        )}
      </Section>
    </SectionGroup>
  );
}
