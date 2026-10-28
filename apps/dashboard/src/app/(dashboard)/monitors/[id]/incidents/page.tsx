"use client";

import { Info, Success } from "@openstatus/icons";
import { heartbeatExpectation } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import {
  EmptyStateDescription,
  EmptyStateMedia,
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
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
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
            ) : monitor.jobType === "heartbeat" ? (
              `Heartbeat · ${heartbeatExpectation(monitor)}`
            ) : (
              monitor.url
            )}
          </SectionDescription>
        </SectionHeader>
        <DataTable
          columns={columns}
          data={monitorIncidents}
          paginationComponent={DataTablePaginationSimple}
          emptyState={
            <DataTableEmpty>
              <EmptyStateMedia variant="success">
                <Success />
              </EmptyStateMedia>
              <EmptyStateTitle>No downtime recorded</EmptyStateTitle>
              <EmptyStateDescription>
                A failed check opens a downtime entry here and alerts the
                channels linked to this monitor. Nothing has failed so far.
              </EmptyStateDescription>
            </DataTableEmpty>
          }
        />
      </Section>
    </SectionGroup>
  );
}
