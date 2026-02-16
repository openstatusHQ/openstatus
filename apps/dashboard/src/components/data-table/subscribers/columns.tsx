"use client";

import { formatDate } from "@/lib/formatter";
import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

type Subscriber = RouterOutputs["pageSubscription"]["list"][number];

export const columns: ColumnDef<Subscriber>[] = [
  {
    accessorKey: "email",
    header: "Email",
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "scope",
    header: "Scope",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const isEntirePage = row.original.isEntirePage;
      const componentCount = row.original.components.length;

      if (isEntirePage) {
        return <Badge variant="outline">Entire Page</Badge>;
      }

      return (
        <Badge variant="secondary">
          {componentCount} {componentCount === 1 ? "Component" : "Components"}
        </Badge>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const unsubscribedAt = row.original.unsubscribedAt;
      const verifiedAt = row.original.verifiedAt;

      if (unsubscribedAt) {
        return <Badge variant="destructive">Unsubscribed</Badge>;
      }

      if (!verifiedAt) {
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
    accessorKey: "verifiedAt",
    header: "Verified At",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("verifiedAt");
      if (value instanceof Date) return formatDate(value);
      if (!value) return "-";
      return value;
    },
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    accessorKey: "unsubscribedAt",
    header: "Unsubscribed At",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("unsubscribedAt");
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
