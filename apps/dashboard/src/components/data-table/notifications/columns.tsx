"use client";

import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { TableCellBadge } from "../table-cell-badge";
import { DataTableRowActions } from "./data-table-row-actions";

type Notifier = RouterOutputs["notification"]["list"][number];

export const columns: ColumnDef<Notifier>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
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
    accessorKey: "monitors",
    header: "Monitors",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("monitors");
      if (Array.isArray(value) && value.length > 0 && "name" in value[0]) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((m) => (
              <TableCellBadge key={m.id} value={m.name} />
            ))}
          </div>
        );
      }
      return <span className="text-muted-foreground">-</span>;
    },
    meta: {
      cellClassName: "tabular-nums font-mono",
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
