"use client";

import { Info } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
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
import { getColumns } from "@/components/data-table/incidents/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useFeature } from "@/hooks/use-feature";
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
  const incidentsEnabled = useFeature("incident-management");
  const columns = useMemo(
    () => getColumns({ declare: incidentsEnabled }),
    [incidentsEnabled],
  );

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
          <DataTable
            columns={columns}
            data={monitorIncidents}
            paginationComponent={DataTablePaginationSimple}
          />
        )}
      </Section>
    </SectionGroup>
  );
}
