"use client";

import { useQuery } from "@tanstack/react-query";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/workspace-incidents/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const trpc = useTRPC();
  const { data: incidents } = useQuery(trpc.incident.list.queryOptions({}));

  if (!incidents) return null;

  const open = incidents.filter((incident) => !incident.resolvedAt);
  const resolved = incidents.filter((incident) => incident.resolvedAt);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Open incidents</SectionTitle>
          <SectionDescription>
            Internal triage state. An incident stays private until you publish
            it as a status report.
          </SectionDescription>
        </SectionHeader>
        {open.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>Nothing is on fire</EmptyStateTitle>
          </EmptyStateContainer>
        ) : (
          <DataTable columns={columns} data={open} />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Resolved</SectionTitle>
        </SectionHeader>
        {resolved.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No resolved incidents yet</EmptyStateTitle>
          </EmptyStateContainer>
        ) : (
          <DataTable columns={columns} data={resolved} />
        )}
      </Section>
    </SectionGroup>
  );
}
