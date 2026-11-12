"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { SlaMonthStrip } from "@/components/sla-policies/sla-month-strip";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { formatSlaTarget } from "@/data/sla-policies.client";

import { TableCellLink } from "../table-cell-link";
import { TableCellNumber } from "../table-cell-number";
import { DataTableRowActions } from "./data-table-row-actions";

type MonitorSlaPolicy = RouterOutputs["monitorSlaPolicy"]["list"][number];

export const columns: ColumnDef<MonitorSlaPolicy>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Policy" />
    ),
    cell: ({ row }) => (
      <TableCellLink
        value={row.original.name}
        href={`/sla-policies/monitors/${row.original.id}`}
        className="font-medium"
      />
    ),
    enableHiding: false,
  },
  {
    accessorKey: "target",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Target" />
    ),
    cell: ({ row }) => (
      <TableCellNumber value={formatSlaTarget(row.original.target)} unit="%" />
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
    cell: ({ row }) => <SlaMonthStrip months={row.original.months} />,
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
