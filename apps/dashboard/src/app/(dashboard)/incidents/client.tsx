"use client";

import { useQuery } from "@tanstack/react-query";

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
  SectionTitle,
} from "@/components/content/section";
import {
  IncidentRow,
  isIncidentActive,
} from "@/components/incidents/incident-row";
import { groupByMonth, pluralize } from "@/data/event-list.client";
import { useShowMore } from "@/hooks/use-show-more";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const { data: incidents } = useQuery(trpc.incident.list.queryOptions());
  const active = incidents?.filter(isIncidentActive) ?? [];
  const ended = useShowMore(
    incidents?.filter((i) => !isIncidentActive(i)) ?? [],
  );
  const months = groupByMonth(ended.visible, (i) => i.declaredAt);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Incidents</SectionTitle>
          <SectionDescription>
            Declare and track the incidents your team is responding to.
          </SectionDescription>
        </SectionHeader>
        {!incidents ? null : incidents.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No incidents declared</EmptyStateTitle>
            <EmptyStateDescription>
              Declared incidents keep the timeline your team builds while
              responding. Nothing here is public: use a status report to tell
              your users.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <EventListGroups>
            {active.length > 0 ? (
              <EventListGroup aria-labelledby="incidents-active">
                <EventListGroupHeader>
                  <EventListGroupTitle id="incidents-active">
                    Active
                  </EventListGroupTitle>
                  <EventListGroupSummary>
                    {pluralize(active.length, "incident")}
                  </EventListGroupSummary>
                </EventListGroupHeader>
                <EventList>
                  {active.map((incident) => (
                    <IncidentRow key={incident.id} incident={incident} />
                  ))}
                </EventList>
              </EventListGroup>
            ) : null}
            {months.map((month) => {
              const critical = month.items.filter(
                (i) => i.severity === "critical",
              ).length;
              return (
                <EventListGroup
                  key={month.key}
                  aria-labelledby={`incidents-${month.key}`}
                >
                  <EventListGroupHeader>
                    <EventListGroupTitle id={`incidents-${month.key}`}>
                      {month.label}
                    </EventListGroupTitle>
                    <EventListGroupSummary>
                      {pluralize(month.items.length, "incident")}
                      {critical > 0 ? ` · ${critical} critical` : null}
                    </EventListGroupSummary>
                  </EventListGroupHeader>
                  <EventList>
                    {month.items.map((incident) => (
                      <IncidentRow key={incident.id} incident={incident} />
                    ))}
                  </EventList>
                </EventListGroup>
              );
            })}
            {ended.hasMore ? <EventListMore onClick={ended.showMore} /> : null}
          </EventListGroups>
        )}
      </Section>
    </SectionGroup>
  );
}
