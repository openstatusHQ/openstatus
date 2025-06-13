"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { DataTable } from "@/components/ui/data-table/data-table";
import { columns } from "@/components/data-table/incidents/columns";
import { incidents } from "@/data/incidents";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";

const EMPTY = false;

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>OpenStatus API</SectionTitle>
          <SectionDescription>https://api.openstatus.dev</SectionDescription>
        </SectionHeader>
        {EMPTY ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No incidents</EmptyStateTitle>
            <EmptyStateDescription>
              No incidents found for this monitor.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
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
