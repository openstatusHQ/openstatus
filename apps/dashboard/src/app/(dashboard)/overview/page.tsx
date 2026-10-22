"use client";

import { Agent } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventList,
  EventListGroup,
  EventListGroupTitle,
} from "@/components/content/event-list";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { Section } from "@/components/content/section";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardLink,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { pluralize } from "@/data/event-list.client";
import { buildOverviewData } from "@/data/overview-events.client";
import { useTRPC } from "@/lib/trpc/client";

import { CreateEventButtonGroup } from "./create-event-button-group";
import { OverviewEventRow, overviewEventKey } from "./overview-event-row";

export default function Page() {
  const trpc = useTRPC();

  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: pages } = useQuery(trpc.page.list.queryOptions());
  // no period — an incident open for weeks must still surface here
  const { data: monitorIncidents } = useQuery(
    trpc.monitorIncident.list.queryOptions(),
  );
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

  if (
    !monitors ||
    !pages ||
    !monitorIncidents ||
    !statusReports ||
    !maintenances ||
    // wait for the incident queries; a failed one still renders (see below)
    openIncidentsPending ||
    endedIncidentsPending
  )
    return null;

  const { needsAttention, upcomingMaintenances, recentlyResolved, metrics } =
    buildOverviewData({
      monitors,
      pages,
      monitorIncidents,
      statusReports,
      maintenances,
      // undefined on a failed query — falls back to the downtime count
      managedIncidents: openIncidents,
      endedIncidents,
    });

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
              {needsAttention.length > 0
                ? `${pluralize(needsAttention.length, "event")} ${needsAttention.length === 1 ? "needs" : "need"} your attention.`
                : "All clear. Nothing needs your attention."}
            </SectionDescription>
          </SectionHeader>
          {pages.length > 0 ? <CreateEventButtonGroup /> : null}
        </SectionHeaderRow>
        <MetricCardGroup>
          {metrics.map((metric) => {
            const content = (
              <>
                <MetricCardHeader className="flex items-center justify-between gap-2">
                  <MetricCardTitle className="truncate">
                    {metric.title}
                  </MetricCardTitle>
                  <metric.icon className="size-4 shrink-0" />
                </MetricCardHeader>
                <MetricCardValue>{metric.value}</MetricCardValue>
              </>
            );
            return metric.href ? (
              <MetricCardLink
                key={metric.title}
                href={metric.href}
                variant={metric.variant}
              >
                {content}
              </MetricCardLink>
            ) : (
              <MetricCard key={metric.title} variant={metric.variant}>
                {content}
              </MetricCard>
            );
          })}
        </MetricCardGroup>
      </Section>
      <EventListGroup aria-labelledby="overview-attention">
        <EventListGroupTitle id="overview-attention">
          Needs attention
        </EventListGroupTitle>
        {needsAttention.length > 0 ? (
          <EventList>
            {needsAttention.map((event) => (
              <OverviewEventRow key={overviewEventKey(event)} event={event} />
            ))}
          </EventList>
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>
              All clear - nothing needs your attention
            </EmptyStateTitle>
          </EmptyStateContainer>
        )}
      </EventListGroup>
      {upcomingMaintenances.length > 0 ? (
        <EventListGroup aria-labelledby="overview-maintenance">
          <EventListGroupTitle id="overview-maintenance">
            Coming up
          </EventListGroupTitle>
          <EventList>
            {upcomingMaintenances.map((event) => (
              <OverviewEventRow key={overviewEventKey(event)} event={event} />
            ))}
          </EventList>
        </EventListGroup>
      ) : null}
      <EventListGroup aria-labelledby="overview-recent">
        <EventListGroupTitle id="overview-recent">
          Last 7 days
        </EventListGroupTitle>
        {recentlyResolved.length > 0 ? (
          <EventList>
            {recentlyResolved.map((event) => (
              <OverviewEventRow key={overviewEventKey(event)} event={event} />
            ))}
          </EventList>
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No recent activity</EmptyStateTitle>
          </EmptyStateContainer>
        )}
      </EventListGroup>
    </SectionGroup>
  );
}
