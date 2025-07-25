"use client";

import { BlockWrapper } from "@/components/content/block-wrapper";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { columns } from "./columns";

export function AuditLogsWrapper({
  monitorId,
  interval,
}: {
  monitorId: string;
  interval: number;
}) {
  const trpc = useTRPC();

  const { data: auditLogs, isLoading } = useQuery(
    trpc.tinybird.auditLog.queryOptions({ monitorId, interval }),
  );

  if (isLoading) {
    return (
      <div className="flex h-full max-h-48 min-h-48 flex-col">
        <Skeleton className="h-full w-full flex-1" />
      </div>
    );
  }

  if (!auditLogs?.data || auditLogs.data.length === 0) {
    return (
      <EmptyStateContainer>
        <EmptyStateTitle>No audit logs</EmptyStateTitle>
        <EmptyStateDescription>
          No audit logs found for this monitor.
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }

  return (
    <BlockWrapper>
      <DataTable
        columns={columns}
        data={auditLogs.data}
        paginationComponent={DataTablePaginationSimple}
      />
    </BlockWrapper>
  );
}

export default AuditLogsWrapper;
