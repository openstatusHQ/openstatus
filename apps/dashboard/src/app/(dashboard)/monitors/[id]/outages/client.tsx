"use client";

import { Success } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import {
  Activity,
  ActivityEmpty,
  ActivityFeed,
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
} from "@/components/content/activity-calendar";
import {
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
  SectionTitle,
} from "@/components/content/section";
import { MonitorIncidentRow } from "@/components/monitor-incidents/monitor-incident-row";
import {
  activityPeriod,
  activityRange,
  groupByDay,
  spansOnDay,
} from "@/data/activity.client";
import { downtimeActivity, downtimeSpan } from "@/data/incidents.client";
import { usePaged } from "@/hooks/use-paged";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const monitorId = Number.parseInt(id);
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: monitorId }),
  );
  const { data: incidents } = useQuery(
    trpc.monitorIncident.list.queryOptions({ monitorId }),
  );

  const ongoing = incidents?.filter((i) => !i.resolvedAt) ?? [];
  const resolved = incidents?.filter((i) => i.resolvedAt) ?? [];
  const paged = usePaged(resolved);

  if (!monitor || !incidents) return null;

  const heartbeat = monitor.jobType === "heartbeat";
  const now = new Date();
  const range = activityRange(now);
  // excused outages count as up, so they leave no mark
  const counted = incidents.filter((i) => i.excusedAt === null);
  const days = groupByDay(range, counted, downtimeSpan, now).map(
    ({ date, items }) => {
      if (items.length === 0) return { date };
      const down = spansOnDay(date, items.map(downtimeSpan), now);
      return {
        date,
        ...downtimeActivity(down),
        lines: [
          `${formatDurationShort(down)} down · ${items.length} ${
            items.length === 1 ? "outage" : "outages"
          }`,
        ],
      };
    },
  );

  return (
    <SectionGroup>
      <Section id="outages">
        <SectionHeader>
          <SectionTitle>Outages</SectionTitle>
          <SectionDescription>
            {heartbeat
              ? "Recorded automatically when a ping is missed or fails."
              : "Recorded automatically when checks fail."}{" "}
            Excuse one that was not real downtime and it counts as up.
          </SectionDescription>
        </SectionHeader>
        <ActivityFeed>
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
                  <ActivityCalendarCell scale="failure" level={1} />
                  {"< 2m"}
                </ActivityCalendarLegendItem>
                <ActivityCalendarLegendItem>
                  <ActivityCalendarCell scale="failure" level={2} />
                  {"< 10m"}
                </ActivityCalendarLegendItem>
                <ActivityCalendarLegendItem>
                  <ActivityCalendarCell scale="failure" level={3} />
                  {"≥ 10m"}
                </ActivityCalendarLegendItem>
              </ActivityCalendarLegend>
            </ActivityCalendar>
          </Activity>
          <div className="flex flex-col gap-6">
            {ongoing.length > 0 ? (
              <EventGroup>
                <EventGroupHeader>
                  <EventGroupTitle>
                    Ongoing
                    <EventGroupCount>{ongoing.length}</EventGroupCount>
                  </EventGroupTitle>
                </EventGroupHeader>
                <EventList>
                  {ongoing.map((incident) => (
                    <MonitorIncidentRow key={incident.id} incident={incident} />
                  ))}
                </EventList>
              </EventGroup>
            ) : null}
            <EventGroup>
              <EventGroupHeader>
                <EventGroupTitle>
                  Resolved
                  <EventGroupCount>{resolved.length}</EventGroupCount>
                </EventGroupTitle>
              </EventGroupHeader>
              <EventList>
                {paged.visible.map((incident) => (
                  <MonitorIncidentRow key={incident.id} incident={incident} />
                ))}
                {paged.hasMore ? (
                  <EventListMore onClick={paged.showMore}>
                    Show older
                  </EventListMore>
                ) : null}
              </EventList>
            </EventGroup>
          </div>
          <ActivityEmpty>
            <EmptyStateMedia variant="success">
              <Success />
            </EmptyStateMedia>
            <EmptyStateTitle>No outages yet</EmptyStateTitle>
            <EmptyStateDescription>
              {heartbeat
                ? "A missed or failed ping opens an outage here and alerts the channels linked to this monitor."
                : "A failed check opens an outage here and alerts the channels linked to this monitor."}
            </EmptyStateDescription>
          </ActivityEmpty>
        </ActivityFeed>
      </Section>
    </SectionGroup>
  );
}
