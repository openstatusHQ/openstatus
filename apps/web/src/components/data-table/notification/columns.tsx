"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Notification } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Notification>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => {
      return (
        <Badge variant="secondary" className="capitalize">
          {row.getValue("provider")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "data",
    header: "Data",
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
