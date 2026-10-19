import { useQuery } from "@tanstack/react-query";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { DataTable as DataTableBase } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

import { columns } from "./columns";

export function DataTable() {
  const trpc = useTRPC();
  const { data: invitations } = useQuery(trpc.invitation.list.queryOptions());

  if (!invitations) return null;

  if (invitations.length === 0) {
    return (
      <EmptyStateContainer>
        <EmptyStateTitle>No pending invitations</EmptyStateTitle>
        <EmptyStateDescription>
          Only active invitations are shown here.
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }

  return (
    <DataTableBase
      columns={columns}
      data={invitations}
      paginationComponent={DataTablePaginationSimple}
    />
  );
}
