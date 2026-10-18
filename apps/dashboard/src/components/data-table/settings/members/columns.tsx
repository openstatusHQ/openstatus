"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { TableCellEmpty } from "../../table-cell-empty";
import { DataTableRowActions } from "./data-table-row-actions";

type Member = RouterOutputs["member"]["list"][number];

export const columns: ColumnDef<Member>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => <MemberName member={row.original} />,
  },
  {
    id: "email",
    header: "Email",
    cell: ({ row }) => row.original.user.email,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <Badge
        variant={row.original.role === "owner" ? "default" : "outline"}
        className="capitalize"
      >
        {row.original.role}
      </Badge>
    ),
  },
  {
    id: "createdAt",
    header: "Created",
    cell: ({ row }) =>
      formatDate(row.original.user.createdAt ?? row.original.createdAt),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];

function MemberName({ member }: { member: Member }) {
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const isMe = Boolean(user?.id && member.user.id === user.id);

  return (
    <div className="flex items-center gap-2">
      {member.user.name || <TableCellEmpty>No name</TableCellEmpty>}
      {isMe ? <Badge variant="secondary">You</Badge> : null}
    </div>
  );
}
