"use client";

import { Agent, Clock, Success } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
import {
  Activity,
  ActivityHeader,
  type ActivityLevel,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import {
  ActivityLane,
  ActivityLaneCount,
  ActivityLaneLabel,
  ActivityLaneMark,
  ActivityLaneTick,
  ActivityLaneTrack,
  ActivityLanes,
  ActivityLanesAxis,
} from "@/components/content/activity-lanes";
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
  activityRange,
  monthsInRange,
  percentInRange,
} from "@/data/activity.client";
import { downtimeActivity } from "@/data/incidents.client";
import { maintenanceActivity } from "@/data/maintenances.client";
import { incidentActivity, incidentSpan } from "@/data/managed-incidents.client";
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
import { formatEventDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { CreateEventButtonGroup } from "./create-event-button-group";
import { OverviewEventRow } from "./overview-event-row";

const lanes = [
  { type: "managedIncident", label: "Incidents", variant: "destructive" },
  { type: "report", label: "Reports", variant: "warning" },
  { type: "maintenance", label: "Maintenance", variant: "info" },
  { type: "incident", label: "Downtime", variant: "default" },
] as const satisfies {
  type: OverviewEvent["type"];
  label: string;
  variant: StatusVariant;
}[];

function activityOf(
  event: OverviewEvent,
  now: Date,
): { variant: StatusVariant; level: ActivityLevel } {
  switch (event.type) {
    case "incident":
      return downtimeActivity(event.incident, now);
    case "managedIncident":
      return incidentActivity(event.incident);
    case "report":
      return reportActivity(event.report);
    case "maintenance": {
      // the lane tick has no outline; spreading it would reach the DOM
      const { variant, level } = maintenanceActivity(event.maintenance, now);
      return { variant, level };
    }
  }
}

function spanOf(event: OverviewEvent): ActivitySpan {
  if (event.type === "report") return reportSpan(event.report);
  if (event.type === "managedIncident") return incidentSpan(event.incident);
  return { start: getStartedAt(event), end: getResolvedAt(event) };
}

function titleOf(event: OverviewEvent): string {
  switch (event.type) {
    case "incident":
      return event.incident.monitor.name;
    case "managedIncident":
      return event.incident.title;
    case "report":
      return event.report.title;
    case "maintenance":
      return event.maintenance.title;
  }
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
  const months = monthsInRange(range);
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
  ]
    // still running or ahead counts too; the tick clamps to the axis edge
    .filter((event) => (spanOf(event).end ?? now) >= range.from);
  const laneEvents = lanes.map((lane) => ({
    ...lane,
    events: events.filter((event) => event.type === lane.type),
  }));
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
        <ActivityLanes>
          <ActivityLanesAxis months={months} />
          {laneEvents.map((lane) => (
            <ActivityLane key={lane.type}>
              <ActivityLaneLabel>
                <StatusDot variant={lane.variant} />
                {lane.label}
              </ActivityLaneLabel>
              <ActivityLaneTrack>
                {months.map((month) => (
                  <ActivityLaneMark key={month.date.getTime()} at={month.at} />
                ))}
                {lane.events.map((event) => (
                  <ActivityLaneTick
                    key={eventKey(event)}
                    at={percentInRange(range, getStartedAt(event))}
                    {...activityOf(event, now)}
                    label={
                      hydrated
                        ? `${formatEventDate(getStartedAt(event), now)} · ${titleOf(event)}`
                        : undefined
                    }
                  />
                ))}
                <ActivityLaneMark at={percentInRange(range, now)} today />
              </ActivityLaneTrack>
              <ActivityLaneCount>{lane.events.length}</ActivityLaneCount>
            </ActivityLane>
          ))}
        </ActivityLanes>
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
