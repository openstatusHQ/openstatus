"use client";

import { useQuery } from "@tanstack/react-query";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/managed-incidents/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useFeature } from "@/hooks/use-feature";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const enabled = useFeature("incident-management");
  const { data: incidents } = useQuery({
    ...trpc.incident.list.queryOptions(),
    enabled,
  });

  if (!enabled) {
    return (
      <SectionGroup>
        <EmptyStateContainer>
          <EmptyStateTitle>Incidents are not available yet</EmptyStateTitle>
          <EmptyStateDescription>
            Incident management is rolling out gradually.
          </EmptyStateDescription>
        </EmptyStateContainer>
      </SectionGroup>
    );
  }

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Incidents</SectionTitle>
          <SectionDescription>
            Declare an incident when the team is responding to an outage: a
            severity, a commander and a timeline, resolved and closed with a
            postmortem. Monitor downtime is detected automatically and lives on
            each monitor.
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
          // incident.list already sorts open first, then newest declared.
          <DataTable columns={columns} data={incidents} />
        )}
      </Section>
    </SectionGroup>
  );
}
