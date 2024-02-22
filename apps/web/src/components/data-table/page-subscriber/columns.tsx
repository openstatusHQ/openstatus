"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { PageSubscriber } from "@openstatus/db/src/schema";

import { formatDateTime } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<PageSubscriber>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      return <span>{row.getValue("email")}</span>;
    },
  },
  {
    accessorKey: "acceptedAt",
    header: "Accepted",
    cell: ({ row }) => {
      const { acceptedAt } = row.original;
      const date = acceptedAt ? formatDateTime(acceptedAt) : "-";
      return <span className="text-muted-foreground">{date}</span>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const { createdAt } = row.original;
      const date = createdAt ? formatDateTime(createdAt) : "-";
      return <span className="text-muted-foreground">{date}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <div className="text-right">
          <DataTableRowActions row={row} />
        </div>
      );
    },
  },
];
