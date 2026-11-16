"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { UptimeMonthStrip } from "@/components/uptime-targets/uptime-month-strip";
import { formatUptimeTarget } from "@/data/reports.client";

import { TableCellLink } from "../table-cell-link";
import { TableCellNumber } from "../table-cell-number";
import { DataTableRowActions } from "./data-table-row-actions";

type UptimeTarget = RouterOutputs["uptimeTarget"]["list"][number];

export const columns: ColumnDef<UptimeTarget>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Uptime target" />
    ),
    cell: ({ row }) => (
      <TableCellLink
        value={row.original.name}
        href={`/uptime-targets/${row.original.id}/overview`}
        className="font-medium"
      />
    ),
    enableHiding: false,
  },
  {
    id: "target",
    accessorFn: (row) => row.target,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Target" />
    ),
    cell: ({ row }) => (
      <TableCellNumber
        value={formatUptimeTarget(row.original.target)}
        unit="%"
      />
    ),
    enableHiding: false,
  },
  {
    id: "monitors",
    accessorFn: (row) => row.monitors.length,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Monitors" />
    ),
    cell: ({ row }) => (
      <TableCellNumber
        value={row.original.monitors.length}
        className="text-muted-foreground"
        title={row.original.monitors.map((m) => m.name).join(", ")}
      />
    ),
    enableHiding: false,
  },
  {
    id: "months",
    header: "Last 12 months",
    cell: ({ row }) => <UptimeMonthStrip months={row.original.months} />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "missed",
    accessorFn: (row) => row.missed.months,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Months missed" />
    ),
    cell: ({ row }) => {
      const { months, previews, of } = row.original.missed;
      return (
        <div className="font-mono tabular-nums">
          <span
            className={
              months > 0 ? "text-destructive" : "text-muted-foreground"
            }
          >
            {months} of {of}
          </span>
          {previews > 0 ? (
            <span className="text-muted-foreground block text-xs">
              {previews} preview{previews === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      );
    },
    enableHiding: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
