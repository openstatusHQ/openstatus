"use client";

import { Agent, Clock, Success } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  Activity,
  ActivityHeader,
  type ActivityMark,
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
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventGroup,
  EventGroupCount,
  EventGroupHeader,
  EventGroupHint,
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
import {
  type ActivitySpan,
  activityDayLines,
  activityRange,
  groupByDay,
  spansOnDay,
} from "@/data/activity.client";
import { downtimeActivity } from "@/data/incidents.client";
import { maintenanceActivity } from "@/data/maintenances.client";
import {
  incidentActivity,
  incidentSpan,
} from "@/data/managed-incidents.client";
import {
  type OverviewEvent,
  buildOverviewData,
  eventKey,
  getResolvedAt,
  getStartedAt,
} from "@/data/overview-events.client";
import { reportActivity, reportSpan } from "@/data/status-reports.client";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePaged } from "@/hooks/use-paged";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { CreateEventButtonGroup } from "./create-event-button-group";
import { OverviewEventRow } from "./overview-event-row";

type Downtime = Extract<OverviewEvent, { type: "incident" }>;
type Maintenance = Extract<OverviewEvent, { type: "maintenance" }>;
type DayEntry = ActivityMark & { lead: string; name: string };

// failures outrank planned work, anything real outranks a hatched mark
function rank(mark: ActivityMark) {
  if (mark.hatched) return 0;
  return mark.scale === "failure" ? 4 + mark.level : mark.level;
}

/**
 * One entry per incident or report, one for the day's downtime and one for
 * its maintenance (both by total time that day), strongest first.
 */
function dayEntries(items: OverviewEvent[], date: Date, now: Date): DayEntry[] {
  const entries: DayEntry[] = [];
  const downtime = items.filter((e): e is Downtime => e.type === "incident");
  const maintenance = items.filter(
    (e): e is Maintenance => e.type === "maintenance",
  );
  for (const event of items) {
    if (event.type === "managedIncident") {
      const { label, ...mark } = incidentActivity(event.incident);
      entries.push({
        ...mark,
        lead: `${label} · ${event.incident.title}`,
        name: label,
      });
    } else if (event.type === "report") {
      const { label, ...mark } = reportActivity(event.report);
      entries.push({
        ...mark,
        lead: `${label} · ${event.report.title}`,
        name: label,
      });
    }
  }
  if (downtime.length > 0) {
    const down = spansOnDay(date, downtime.map(spanOf), now);
    const monitors = new Set(downtime.map((e) => e.incident.monitor.name));
    entries.push({
      ...downtimeActivity(down),
      lead: `${formatDurationShort(down)} down · ${
        monitors.size === 1 ? [...monitors][0] : `${monitors.size} monitors`
      }`,
      name: "Downtime",
    });
  }
  if (maintenance.length > 0) {
    const planned = spansOnDay(date, maintenance.map(spanOf), now);
    entries.push({
      ...maintenanceActivity(planned),
      lead: `${formatDurationShort(planned)} · ${
        maintenance.length === 1
          ? maintenance[0].maintenance.title
          : `${maintenance.length} maintenances`
      }`,
      name: "Maintenance",
    });
  }
  return entries.sort((a, b) => rank(b) - rank(a));
}

function linkOf(event: OverviewEvent): { href: string; title: string } {
  switch (event.type) {
    case "incident":
      return {
        href: `/monitors/${event.incident.monitor.id}/incidents`,
        title: event.incident.monitor.name,
      };
    case "managedIncident":
      return {
        href: `/incidents/${event.incident.id}`,
        title: event.incident.title,
      };
    case "report":
      return {
        href: `/status-pages/${event.report.pageId}/status-reports/${event.report.id}`,
        title: event.report.title,
      };
    case "maintenance":
      return {
        href: `/status-pages/${event.maintenance.pageId}/maintenances/${event.maintenance.id}`,
        title: event.maintenance.title,
      };
  }
}

function spanOf(event: OverviewEvent): ActivitySpan {
  if (event.type === "report") return reportSpan(event.report);
  if (event.type === "managedIncident") return incidentSpan(event.incident);
  return { start: getStartedAt(event), end: getResolvedAt(event) };
}

export default function Page() {
  const trpc = useTRPC();
  const hydrated = useHydrated();
  const [showOlder, setShowOlder] = useState(false);

  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: pages } = useQuery(trpc.page.list.queryOptions());
  // no period — an incident open for weeks must still surface here
  const { data: monitorIncidents } = useQuery({
    ...trpc.monitorIncident.list.queryOptions(),
    // downtime of deleted monitors would surface under a monitor that no longer exists
    select: (incidents) =>
      incidents.filter((i) => i.monitor && i.monitor.deletedAt === null),
  });
  const { data: statusReports } = useQuery(
    trpc.statusReport.list.queryOptions({}),
  );
  const { data: maintenances } = useQuery(trpc.maintenance.list.queryOptions());
  const { data: openIncidents, isPending: openIncidentsPending } = useQuery(
    trpc.incident.list.queryOptions({ status: ["open", "mitigated"] }),
  );
  const { data: endedIncidents, isPending: endedIncidentsPending } = useQuery(
    trpc.incident.list.queryOptions({ status: ["resolved", "canceled"] }),
  );

  const now = new Date();
  const data =
    monitors &&
    pages &&
    monitorIncidents &&
    statusReports &&
    maintenances &&
    // wait for the incident queries; a failed one still renders (see below)
    !openIncidentsPending &&
    !endedIncidentsPending
      ? buildOverviewData(
          {
            monitors,
            pages,
            monitorIncidents,
            statusReports,
            maintenances,
            // undefined on a failed query — falls back to the downtime count
            managedIncidents: openIncidents,
            endedIncidents,
          },
          now,
        )
      : null;
  const older = usePaged(
    data ? data.allResolved.slice(data.recentlyResolved.length) : [],
  );

  if (!data || !pages || !statusReports || !maintenances || !monitorIncidents)
    return null;

  const {
    needsAttention,
    upcomingMaintenances,
    recentlyResolved,
    allResolved,
  } = data;

  const range = activityRange(now);
  const events: OverviewEvent[] = [
    ...(openIncidents ?? []).map((incident) => ({
      type: "managedIncident" as const,
      incident,
    })),
    ...(endedIncidents ?? []).map((incident) => ({
      type: "managedIncident" as const,
      incident,
    })),
    ...statusReports.map((report) => ({ type: "report" as const, report })),
    ...maintenances.map((maintenance) => ({
      type: "maintenance" as const,
      maintenance,
    })),
    ...monitorIncidents.map((incident) => ({
      type: "incident" as const,
      incident,
    })),
  ].filter((event) => {
    // still running counts too
    const { start, end } = spanOf(event);
    return (end ?? now) >= range.from && start <= range.to;
  });
  const days = groupByDay(range, events, spanOf, now).map(({ date, items }) => {
    if (items.length === 0) return { date };
    const [lead, ...others] = dayEntries(items, date, now);
    const links = new Map(items.map(linkOf).map((l) => [l.href, l]));
    // dashed only when the day holds nothing but maintenance still ahead
    const upcoming = items.every(
      (e) => e.type === "maintenance" && e.maintenance.from > now,
    );
    return {
      date,
      scale: lead.scale,
      level: lead.level,
      hatched: lead.hatched,
      upcoming,
      lines: [
        ...activityDayLines(
          lead.lead,
          others.map((e) => e.name),
        ),
        ...(upcoming ? ["Upcoming"] : []),
      ],
      links: [...links.values()],
    };
  });
  const attention = needsAttention.length;

  return (
    <SectionGroup>
      <NoteDismissible cookieKey="note_overview_slack_agent">
        <Agent />
        Use our Slack agent to manage your status pages and incidents.
        <NoteButton variant="default" asChild>
          <Link href="/agents">Learn more</Link>
        </NoteButton>
      </NoteDismissible>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Overview</SectionTitle>
            <SectionDescription>
              {hydrated ? `${format(now, "EEEE, MMM d")} · ` : null}
              {attention === 0
                ? "Nothing needs your attention"
                : `${attention} ${attention === 1 ? "event needs" : "events need"} your attention`}
            </SectionDescription>
          </SectionHeader>
          {pages.length > 0 ? <CreateEventButtonGroup /> : null}
        </SectionHeaderRow>
      </Section>
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
              Low
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell level={2} />
              Mid
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell level={3} />
              High
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendSeparator />
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell hatched />
              Unrated
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell scale="planned" level={2} />
              Maintenance
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell upcoming />
              Upcoming
            </ActivityCalendarLegendItem>
          </ActivityCalendarLegend>
        </ActivityCalendar>
      </Activity>
      <EventGroup>
        <EventGroupHeader>
          <EventGroupTitle>
            Open
            <EventGroupCount>{needsAttention.length}</EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>Stays here until resolved</EventGroupHint>
        </EventGroupHeader>
        {needsAttention.length > 0 ? (
          <EventList>
            {needsAttention.map((event) => (
              <OverviewEventRow key={eventKey(event)} event={event} />
            ))}
          </EventList>
        ) : (
          <EmptyStateContainer>
            <EmptyStateMedia variant="success">
              <Success />
            </EmptyStateMedia>
            <EmptyStateTitle>All clear</EmptyStateTitle>
            <EmptyStateDescription>
              {openIncidents
                ? "Nothing is unresolved. Failing monitors, open incidents and status reports show up here."
                : "Incidents could not be loaded. Failing monitors and open status reports still show up here."}
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </EventGroup>
      {upcomingMaintenances.length > 0 ? (
        <EventGroup>
          <EventGroupHeader>
            <EventGroupTitle>
              Scheduled
              <EventGroupCount>{upcomingMaintenances.length}</EventGroupCount>
            </EventGroupTitle>
          </EventGroupHeader>
          <EventList>
            {upcomingMaintenances.map((event) => (
              <OverviewEventRow key={eventKey(event)} event={event} />
            ))}
          </EventList>
        </EventGroup>
      ) : null}
      <EventGroup>
        <EventGroupHeader>
          <EventGroupTitle>
            Resolved
            <EventGroupCount>
              {showOlder ? allResolved.length : recentlyResolved.length}
            </EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>
            {showOlder ? "All time" : "Last 7 days"}
          </EventGroupHint>
        </EventGroupHeader>
        {recentlyResolved.length > 0 || showOlder ? (
          <EventList>
            {[...recentlyResolved, ...(showOlder ? older.visible : [])].map(
              (event) => (
                <OverviewEventRow key={eventKey(event)} event={event} />
              ),
            )}
            {!showOlder && allResolved.length > recentlyResolved.length ? (
              <EventListMore onClick={() => setShowOlder(true)}>
                Show older
              </EventListMore>
            ) : null}
            {showOlder && older.hasMore ? (
              <EventListMore onClick={older.showMore}>Show more</EventListMore>
            ) : null}
          </EventList>
        ) : (
          <EmptyStateContainer>
            <EmptyStateMedia>
              <Clock />
            </EmptyStateMedia>
            <EmptyStateTitle>No recent activity</EmptyStateTitle>
            <EmptyStateDescription>
              {endedIncidents
                ? "Resolved incidents and reports and completed maintenances from the last 7 days land here."
                : "Incidents could not be loaded. Resolved reports and completed maintenances from the last 7 days still show up here."}
            </EmptyStateDescription>
            {allResolved.length > 0 ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground mt-2 text-sm"
                onClick={() => setShowOlder(true)}
              >
                Show older
              </button>
            ) : null}
          </EmptyStateContainer>
        )}
      </EventGroup>
    </SectionGroup>
  );
}
