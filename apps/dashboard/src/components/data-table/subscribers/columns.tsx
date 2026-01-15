"use client";

import { formatDate } from "@/lib/formatter";
import { Badge } from "@/components/ui/badge";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

export const columns: ColumnDef<Subscriber>[] = [
  {
    accessorKey: "email",
    header: "Email",
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const unsubscribedAt = row.original.unsubscribedAt;
      const acceptedAt = row.original.acceptedAt;

      if (unsubscribedAt) {
        return (
          <Badge variant="destructive">
            Unsubscribed {formatDate(unsubscribedAt)}
          </Badge>
        );
      }

      if (!acceptedAt) {
        return <Badge variant="outline">Pending</Badge>;
      }

      return <Badge variant="secondary">Active</Badge>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("createdAt");
      if (value instanceof Date) return formatDate(value);
      if (!value) return "-";
      return value;
    },
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    accessorKey: "acceptedAt",
    header: "Accepted At",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("acceptedAt");
      if (value instanceof Date) return formatDate(value);
      if (!value) return "-";
      return value;
    },
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
