"use client";

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
import { columns } from "@/components/data-table/incidents/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: incidents } = useQuery(
    trpc.incident.list.queryOptions({
      monitorId: parseInt(id),
    })
  );
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );

  if (!incidents || !monitor) return null;

  return (
    <SectionGroup>
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
        {incidents.length === 0 ? (
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
