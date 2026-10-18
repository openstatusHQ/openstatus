"use client";

import { Info } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventList,
  EventListGroup,
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
import { DowntimeRow } from "@/components/downtime/downtime-row";
import { groupByMonth } from "@/data/event-list.client";
import { useShowMore } from "@/hooks/use-show-more";
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

  const ongoing = monitorIncidents?.filter((i) => i.resolvedAt === null) ?? [];
  const resolved = useShowMore(
    monitorIncidents?.filter((i) => i.resolvedAt !== null) ?? [],
  );
  const months = groupByMonth(resolved.visible, (i) => i.startedAt);

  if (!monitorIncidents || !monitor) return null;

  return (
    <SectionGroup>
      <Note color="info">
        <Info />
        <p>
          Downtime is recorded automatically when a monitor fails. To tell your
          users, use Status Reports on a{" "}
          <Link href="/status-pages">Status Page</Link>.
        </p>
      </Note>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            {monitor.jobType === "http" ? (
              <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                {monitor.url}
              </a>
            ) : (
              monitor.url
            )}
          </SectionDescription>
        </SectionHeader>
        {monitorIncidents.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No downtime</EmptyStateTitle>
            <EmptyStateDescription>
              No downtime recorded for this monitor.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <EventListGroups>
            {ongoing.length > 0 ? (
              <EventListGroup aria-labelledby="downtime-ongoing">
                <EventListGroupTitle id="downtime-ongoing">
                  Ongoing
                </EventListGroupTitle>
                <EventList>
                  {ongoing.map((downtime) => (
                    <DowntimeRow key={downtime.id} downtime={downtime} />
                  ))}
                </EventList>
              </EventListGroup>
            ) : null}
            {months.map((month) => (
              <EventListGroup
                key={month.key}
                aria-labelledby={`downtime-${month.key}`}
              >
                <EventListGroupTitle id={`downtime-${month.key}`}>
                  {month.label}
                </EventListGroupTitle>
                <EventList>
                  {month.items.map((downtime) => (
                    <DowntimeRow key={downtime.id} downtime={downtime} />
                  ))}
                </EventList>
              </EventListGroup>
            ))}
            {resolved.hasMore ? (
              <EventListMore onClick={resolved.showMore} />
            ) : null}
          </EventListGroups>
        )}
      </Section>
    </SectionGroup>
  );
}
