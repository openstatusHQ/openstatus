"use client";

import { Badge } from "@/components/ui/badge";
import { Notifier } from "@/data/notifiers";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Notifier>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "provider",
    header: "Provider",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <Badge variant="secondary" className="px-1.5 font-mono text-[10px]">
          {row.getValue("provider")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "value",
    header: "Value",
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "text-foreground/70",
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
