"use client";

import { Maintenance } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import {
  Activity,
  ActivityHeader,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import {
  ActivityCalendar,
  ActivityCalendarCell,
  ActivityCalendarGrid,
  ActivityCalendarLegend,
  ActivityCalendarLegendItem,
  ActivityCalendarLegendSeparator,
} from "@/components/content/activity-calendar";
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
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { MaintenanceRow } from "@/components/maintenances/maintenance-row";
import { useMaintenanceTick } from "@/components/maintenances/use-maintenance-status";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import {
  activityPeriod,
  activityRange,
  groupByDay,
  spansOnDay,
} from "@/data/activity.client";
import {
  maintenanceActivity,
  maintenanceSpan,
} from "@/data/maintenances.client";
import { getMaintenanceStatus } from "@/data/overview-events.client";
import { usePaged } from "@/hooks/use-paged";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
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

  // regroups when a window starts or ends, in step with each row's status
  useMaintenanceTick(maintenances ?? []);
  const now = new Date();
  const upcoming = (maintenances ?? [])
    .filter((m) => getMaintenanceStatus(m, now) !== "completed")
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const past = (maintenances ?? [])
    .filter((m) => getMaintenanceStatus(m, now) === "completed")
    .sort((a, b) => b.from.getTime() - a.from.getTime());
  const paged = usePaged(past);

  if (!statusPage || !maintenances) return null;

  const items = toCheckboxTreeItems(
    statusPage.pageComponents,
    statusPage.pageComponentGroups,
  );
  const createMaintenance = async (
    values: Parameters<
      React.ComponentProps<typeof FormSheetMaintenance>["onSubmit"]
    >[0],
  ) => {
    await createMaintenanceMutation.mutateAsync({
      pageId: Number.parseInt(id),
      title: values.title,
      message: values.message ?? "",
      startDate: values.startDate,
      endDate: values.endDate,
      pageComponents: values.pageComponents,
      notifySubscribers: values.notifySubscribers,
    });
  };

  // looks ahead as far as the last scheduled window ends, capped
  const until = upcoming
    .map((m) => m.to)
    .reduce<Date | undefined>(
      (max, to) => (!max || to > max ? to : max),
      undefined,
    );
  const range = activityRange(now, until);
  const days = groupByDay(range, maintenances, maintenanceSpan, now).map(
    ({ date, items }) => {
      if (items.length === 0) return { date };
      const planned = spansOnDay(date, items.map(maintenanceSpan), now);
      // dashed only when every window that day is still ahead
      const scheduled = items.every((m) => m.from > now);
      return {
        date,
        ...maintenanceActivity(planned),
        upcoming: scheduled,
        lines: [
          `${formatDurationShort(planned)} · ${
            items.length === 1 ? items[0].title : `${items.length} maintenances`
          }`,
          ...(scheduled ? ["Upcoming"] : []),
        ],
        links: items.map((m) => ({
          href: `/status-pages/${m.pageId}/maintenances/${m.id}`,
          title: m.title,
        })),
      };
    },
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{statusPage.title}</SectionTitle>
            <SectionDescription>
              Scheduled maintenance windows shown on this status page. Looking
              for{" "}
              <Link href={`/status-pages/${id}/status-reports`}>
                status reports
              </Link>
              ?
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetMaintenance
              open={openCreate}
              onOpenChange={setOpenCreate}
              items={items}
              onSubmit={createMaintenance}
            >
              <Button data-section="action" size="sm">
                Create maintenance
              </Button>
            </FormSheetMaintenance>
          </div>
        </SectionHeaderRow>
        {maintenances.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateMedia>
              <Maintenance />
            </EmptyStateMedia>
            <EmptyStateTitle>No maintenance scheduled</EmptyStateTitle>
            <EmptyStateDescription>
              Announce planned downtime ahead of time. During the window the
              affected components show as under maintenance instead of
              triggering alerts.
            </EmptyStateDescription>
            <EmptyStateActions>
              <Button size="sm" onClick={() => setOpenCreate(true)}>
                Schedule maintenance
              </Button>
              <Button size="sm" variant="outline" asChild>
                <NextLink href={`/status-pages/${id}/status-reports`}>
                  View status reports
                </NextLink>
              </Button>
            </EmptyStateActions>
          </EmptyStateContainer>
        ) : (
          <>
            <Activity>
              <ActivityHeader>
                <ActivityTitle>Activity</ActivityTitle>
                <ActivityPeriod>{activityPeriod(range, now)}</ActivityPeriod>
              </ActivityHeader>
              <ActivityCalendar>
                <ActivityCalendarGrid days={days} today={now} />
                <ActivityCalendarLegend>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell />
                    None
                  </ActivityCalendarLegendItem>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell scale="planned" level={1} />
                    Under 1h
                  </ActivityCalendarLegendItem>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell scale="planned" level={2} />1 to 4h
                  </ActivityCalendarLegendItem>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell scale="planned" level={3} />
                    Over 4h
                  </ActivityCalendarLegendItem>
                  {days.some((day) => "upcoming" in day && day.upcoming) ? (
                    <>
                      <ActivityCalendarLegendSeparator />
                      <ActivityCalendarLegendItem>
                        <ActivityCalendarCell upcoming />
                        Upcoming
                      </ActivityCalendarLegendItem>
                    </>
                  ) : null}
                </ActivityCalendarLegend>
              </ActivityCalendar>
            </Activity>
            <div className="flex flex-col gap-6">
              {upcoming.length > 0 ? (
                <EventGroup>
                  <EventGroupHeader>
                    <EventGroupTitle>
                      Upcoming
                      <EventGroupCount>{upcoming.length}</EventGroupCount>
                    </EventGroupTitle>
                  </EventGroupHeader>
                  <EventList>
                    {upcoming.map((maintenance) => (
                      <MaintenanceRow
                        key={maintenance.id}
                        maintenance={maintenance}
                      />
                    ))}
                  </EventList>
                </EventGroup>
              ) : null}
              {past.length > 0 ? (
                <EventGroup>
                  <EventGroupHeader>
                    <EventGroupTitle>
                      Past
                      <EventGroupCount>{past.length}</EventGroupCount>
                    </EventGroupTitle>
                  </EventGroupHeader>
                  <EventList>
                    {paged.visible.map((maintenance) => (
                      <MaintenanceRow
                        key={maintenance.id}
                        maintenance={maintenance}
                      />
                    ))}
                    {paged.hasMore ? (
                      <EventListMore onClick={paged.showMore}>
                        Show older
                      </EventListMore>
                    ) : null}
                  </EventList>
                </EventGroup>
              ) : null}
            </div>
          </>
        )}
      </Section>
    </SectionGroup>
  );
}
