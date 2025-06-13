"use client";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { Incident } from "@/data/incidents";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "monitor",
    header: "Monitor",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <TableCellLink
          value={row.getValue("monitor")}
          href="/dashboard/monitors/overview"
        />
      );
    },
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
  },
  {
    accessorKey: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started At" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("startedAt")} />,
    enableHiding: false,
  },
  {
    accessorKey: "acknowledged",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Acknowledged" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("acknowledged")} />,
    enableHiding: false,
  },
  {
    accessorKey: "resolvedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Resolved At" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("resolvedAt")} />,
    enableHiding: false,
  },
  {
    id: "duration",
    accessorFn: (row) => formatDistanceStrict(row.startedAt, row.resolvedAt),
    header: "Duration",
    cell: ({ row }) => {
      const value = row.getValue("duration");
      if (typeof value === "string") {
        const [amount, unit] = value.split(" ");
        return <TableCellNumber value={amount} unit={unit} />;
      }
      return <TableCellNumber value={value} />;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
