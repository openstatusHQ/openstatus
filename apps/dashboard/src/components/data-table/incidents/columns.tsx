"use client";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";
import { DataTableRowActions } from "./data-table-row-actions";

type Incident = RouterOutputs["incident"]["list"][number];

export const columns: ColumnDef<Incident>[] = [
  {
    id: "monitor",
    accessorFn: (row) => row.monitor.name,
    header: "Monitor",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <TableCellLink
          value={row.getValue("monitor")}
          href={`/monitors/${row.original.monitor.id}/overview`}
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
    accessorKey: "acknowledgedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Acknowledged" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("acknowledgedAt")} />,
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
    accessorFn: (row) =>
      row.resolvedAt
        ? formatDistanceStrict(row.startedAt, row.resolvedAt)
        : "ongoing",
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
    meta: {
      cellClassName: "w-8",
    },
  },
];
