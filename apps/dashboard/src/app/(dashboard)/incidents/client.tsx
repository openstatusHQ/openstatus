"use client";

import { Incident } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

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
import { DeclareIncidentButton } from "@/components/incidents/declare-incident-button";
import { IncidentRow } from "@/components/incidents/incident-row";
import {
  activityDayLabel,
  activityRange,
  groupByDay,
  strongestMark,
} from "@/data/activity.client";
import {
  incidentActivity,
  incidentSpan,
  severityConfig,
} from "@/data/managed-incidents.client";
import { usePaged } from "@/hooks/use-paged";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const { data: incidents } = useQuery(trpc.incident.list.queryOptions());

  const byStart = <T extends { startedAt: Date }>(a: T, b: T) =>
    b.startedAt.getTime() - a.startedAt.getTime();
  const active = (incidents ?? [])
    .filter((i) => i.status === "open" || i.status === "mitigated")
    .sort(byStart);
  const closed = (incidents ?? [])
    .filter((i) => i.status === "resolved" || i.status === "canceled")
    .sort(byStart);
  const paged = usePaged(closed);

  if (!incidents) return null;

  const now = new Date();
  const range = activityRange(now);
  const grouped = groupByDay(range, incidents, incidentSpan, now);
  const days = grouped.map(({ date, items }) => ({
    date,
    ...strongestMark(items.map(incidentActivity)),
    label: activityDayLabel(
      date,
      items.map((i) => i.title),
      "incidents",
    ),
    links: items.map((i) => ({ href: `/incidents/${i.id}`, title: i.title })),
  }));

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Incidents</SectionTitle>
            <SectionDescription>
              What your team is responding to.
            </SectionDescription>
          </SectionHeader>
          <div>
            <DeclareIncidentButton>
              <Button data-section="action" size="sm">
                Declare incident
              </Button>
            </DeclareIncidentButton>
          </div>
        </SectionHeaderRow>
        {incidents.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateMedia>
              <Incident />
            </EmptyStateMedia>
            <EmptyStateTitle>No incidents declared</EmptyStateTitle>
            <EmptyStateDescription>
              A declared incident keeps the timeline your team builds while
              responding. Nothing here is public: a status report is what tells
              your users.
            </EmptyStateDescription>
            <EmptyStateActions>
              <DeclareIncidentButton>
                <Button size="sm">Declare incident</Button>
              </DeclareIncidentButton>
              <Button size="sm" variant="outline" asChild>
                <Link href="/status-pages">Pick a status page</Link>
              </Button>
            </EmptyStateActions>
          </EmptyStateContainer>
        ) : (
          <>
            <Activity>
              <ActivityHeader>
                <ActivityTitle>Activity</ActivityTitle>
                <ActivityPeriod>Last 12 months</ActivityPeriod>
              </ActivityHeader>
              <ActivityCalendar>
                <ActivityCalendarGrid days={days} today={now} />
                <ActivityCalendarLegend>
                  {(["minor", "major", "critical"] as const).map(
                    (severity, i) => (
                      <ActivityCalendarLegendItem key={severity}>
                        <ActivityCalendarCell
                          variant={severityConfig[severity].variant}
                          level={(i + 1) as 1 | 2 | 3}
                        />
                        {severityConfig[severity].label}
                      </ActivityCalendarLegendItem>
                    ),
                  )}
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell level={1} />
                    Canceled
                  </ActivityCalendarLegendItem>
                </ActivityCalendarLegend>
              </ActivityCalendar>
            </Activity>
            <div className="flex flex-col gap-6">
              {active.length > 0 ? (
                <EventGroup>
                  <EventGroupHeader>
                    <EventGroupTitle>
                      Active
                      <EventGroupCount>{active.length}</EventGroupCount>
                    </EventGroupTitle>
                  </EventGroupHeader>
                  <EventList>
                    {active.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} />
                    ))}
                  </EventList>
                </EventGroup>
              ) : null}
              {closed.length > 0 ? (
                <EventGroup>
                  <EventGroupHeader>
                    <EventGroupTitle>
                      Closed
                      <EventGroupCount>{closed.length}</EventGroupCount>
                    </EventGroupTitle>
                  </EventGroupHeader>
                  <EventList>
                    {paged.visible.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} />
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
