"use client";

import { Success } from "@openstatus/icons";
import { heartbeatExpectation } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { Link } from "@/components/common/link";
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
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { MonitorIncidentRow } from "@/components/monitor-incidents/monitor-incident-row";
import { activityRange, groupByDay, spansOnDay } from "@/data/activity.client";
import { downtimeActivity, downtimeSpan } from "@/data/incidents.client";
import { usePaged } from "@/hooks/use-paged";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: monitorIncidents } = useQuery(
    trpc.monitorIncident.list.queryOptions({
      monitorId: Number.parseInt(id),
    }),
  );
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  const byStart = <T extends { startedAt: Date }>(a: T, b: T) =>
    b.startedAt.getTime() - a.startedAt.getTime();
  const ongoing = (monitorIncidents ?? [])
    .filter((i) => !i.resolvedAt)
    .sort(byStart);
  const resolved = (monitorIncidents ?? [])
    .filter((i) => i.resolvedAt)
    .sort(byStart);
  const paged = usePaged(resolved);

  if (!monitorIncidents || !monitor) return null;

  const now = new Date();
  const range = activityRange(now);
  const days = groupByDay(range, monitorIncidents, downtimeSpan, now).map(
    ({ date, items }) => {
      if (items.length === 0) return { date };
      const down = spansOnDay(date, items.map(downtimeSpan), now);
      return {
        date,
        ...downtimeActivity(down),
        lines: [
          `${formatDurationShort(down)} down`,
          ...(items.length > 1 ? [`${items.length} outages`] : []),
        ],
      };
    },
  );

  return (
    <SectionGroup>
      <Section id="incidents">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{monitor.name}</SectionTitle>
            <SectionDescription>
              {monitor.jobType === "http" ? (
                <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                  {monitor.url}
                </a>
              ) : monitor.jobType === "heartbeat" ? (
                `Heartbeat · ${heartbeatExpectation(monitor)}`
              ) : (
                monitor.url
              )}
            </SectionDescription>
          </SectionHeader>
          <p className="text-muted-foreground text-xs">
            {monitor.jobType === "heartbeat"
              ? "Recorded automatically when a ping is missed or fails"
              : "Recorded automatically when checks fail"}{" "}
            ·{" "}
            <Link href="/status-pages" className="text-xs">
              Tell users via a status report
            </Link>
          </p>
        </SectionHeaderRow>
        <ActivityFeed>
          <Activity>
            <ActivityHeader>
              <ActivityTitle>Activity</ActivityTitle>
              <ActivityPeriod>Last 12 months</ActivityPeriod>
            </ActivityHeader>
            <ActivityCalendar>
              <ActivityCalendarGrid days={days} today={now} />
              <ActivityCalendarLegend>
                <ActivityCalendarLegendItem>
                  <ActivityCalendarCell />
                  None
                </ActivityCalendarLegendItem>
                <ActivityCalendarLegendItem>
                  <ActivityCalendarCell level={1} />
                  {"< 2m"}
                </ActivityCalendarLegendItem>
                <ActivityCalendarLegendItem>
                  <ActivityCalendarCell level={2} />
                  {"< 10m"}
                </ActivityCalendarLegendItem>
                <ActivityCalendarLegendItem>
                  <ActivityCalendarCell level={3} />
                  {"≥ 10m"}
                </ActivityCalendarLegendItem>
              </ActivityCalendarLegend>
            </ActivityCalendar>
          </Activity>
          <div className="flex flex-col gap-6">
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
            <EventGroup>
              <EventGroupHeader>
                <EventGroupTitle>
                  Downtime
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
            <EmptyStateTitle>No downtime recorded</EmptyStateTitle>
            <EmptyStateDescription>
              {monitor.jobType === "heartbeat"
                ? "A missed or failed ping opens a downtime entry here and alerts the channels linked to this monitor. Nothing has been missed so far."
                : "A failed check opens a downtime entry here and alerts the channels linked to this monitor. Nothing has failed so far."}
            </EmptyStateDescription>
          </ActivityEmpty>
        </ActivityFeed>
      </Section>
    </SectionGroup>
  );
}
