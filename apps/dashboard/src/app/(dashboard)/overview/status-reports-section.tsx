"use client";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { DataTableStatusReports } from "./data-table-status-reports";

/**
 * Client component for status reports section.
 * Uses useQuery to enable React Query invalidation after mutations.
 * Initial data comes from server prefetch (no loading spinner on first render).
 */
export function StatusReportsSection() {
  const trpc = useTRPC();

  // This query uses hydrated data from server prefetch on initial load
  // After mutations, invalidateQueries will trigger refetch and re-render
  const { data: statusReports } = useQuery(
    trpc.statusReport.list.queryOptions({
      period: "7d",
    }),
  );

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Reports</SectionTitle>
        <SectionDescription>Reports over the last 7 days.</SectionDescription>
      </SectionHeader>
      {statusReports && statusReports.length > 0 ? (
        <DataTableStatusReports statusReports={statusReports} />
      ) : (
        <EmptyStateContainer>
          <EmptyStateTitle>No reports found</EmptyStateTitle>
        </EmptyStateContainer>
      )}
    </Section>
  );
}
