"use client";

import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { TableCellBadge } from "../table-cell-badge";
import { TableCellDate } from "../table-cell-date";
import { DataTableRowActions } from "./data-table-row-actions";

type PrivateLocation = RouterOutputs["privateLocation"]["list"][number];

export const columns: ColumnDef<PrivateLocation>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    enableHiding: false,
  },
  {
    accessorKey: "lastSeenAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Seen At" />
    ),
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("lastSeenAt");
      return <TableCellDate value={value} />;
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
              <Link href={`/monitors/${m.id}`} key={m.id}>
                <TableCellBadge value={m.name} />
              </Link>
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
