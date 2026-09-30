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
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
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
          // incident.list already sorts open first, then newest declared.
          <DataTable
            columns={columns}
            data={incidents}
            paginationComponent={DataTablePaginationSimple}
          />
        )}
      </Section>
    </SectionGroup>
  );
}
