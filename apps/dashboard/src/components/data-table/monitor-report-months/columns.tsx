"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { type ReportMonth, formatAvailability } from "@/data/monitor-report";
import { monthKeyToFullLabel } from "@/data/status-page-history";
import { formatDurationShort } from "@/lib/formatter";

export const columns: ColumnDef<ReportMonth>[] = [
  {
    accessorKey: "month",
    header: "Month",
    cell: ({ row }) => (
      <TableCellText value={monthKeyToFullLabel(row.original.month)} />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "availability",
    header: "Availability",
    cell: ({ row }) => (
      <div className="font-mono">
        {formatAvailability(row.original.availability)}
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "downtimeMs",
    header: "Downtime",
    cell: ({ row }) =>
      row.original.downtimeMs > 0 ? (
        <div className="font-mono">
          {formatDurationShort(row.original.downtimeMs)}
        </div>
      ) : (
        <TableCellNumber value={undefined} />
      ),
    enableSorting: false,
  },
  {
    accessorKey: "outages",
    header: "Outages",
    cell: ({ row }) => <TableCellNumber value={row.original.outages} />,
    enableSorting: false,
  },
];
