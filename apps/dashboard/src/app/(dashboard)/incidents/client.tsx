"use client";

import { Incident } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import {
  EmptyStateActions,
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
import { columns } from "@/components/data-table/managed-incidents/columns";
import { DeclareIncidentButton } from "@/components/incidents/declare-incident-button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const { data: incidents } = useQuery(trpc.incident.list.queryOptions());

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Incidents</SectionTitle>
          <SectionDescription>
            Declare and track the incidents your team is responding to.
          </SectionDescription>
        </SectionHeader>
        {!incidents ? null : (
          <DataTable
            columns={columns}
            data={incidents}
            paginationComponent={DataTablePaginationSimple}
            emptyState={
              <DataTableEmpty>
                <EmptyStateMedia>
                  <Incident />
                </EmptyStateMedia>
                <EmptyStateTitle>No incidents declared</EmptyStateTitle>
                <EmptyStateDescription>
                  A declared incident keeps the timeline your team builds while
                  responding. Nothing here is public: a status report is what
                  tells your users.
                </EmptyStateDescription>
                <EmptyStateActions>
                  <DeclareIncidentButton>
                    <Button size="sm">Declare incident</Button>
                  </DeclareIncidentButton>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/status-pages">Pick a status page</Link>
                  </Button>
                </EmptyStateActions>
              </DataTableEmpty>
            }
          />
        )}
      </Section>
    </SectionGroup>
  );
}
