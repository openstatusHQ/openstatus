import { Invite } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";

import {
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { DataTable as DataTableBase } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

import { columns } from "./columns";

export function DataTable() {
  const trpc = useTRPC();
  const { data: invitations } = useQuery(trpc.invitation.list.queryOptions());

  if (!invitations) return null;

  return (
    <DataTableBase
      columns={columns}
      data={invitations}
      paginationComponent={DataTablePaginationSimple}
      emptyState={
        <DataTableEmpty>
          <EmptyStateMedia>
            <Invite />
          </EmptyStateMedia>
          <EmptyStateTitle>No pending invitations</EmptyStateTitle>
          <EmptyStateDescription>
            Invite a member below. Accepted and expired invitations drop off
            this list.
          </EmptyStateDescription>
        </DataTableEmpty>
      }
    />
  );
}
