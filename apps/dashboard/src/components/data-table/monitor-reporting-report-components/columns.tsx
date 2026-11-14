"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { formatSlaDuration } from "@/data/reportings.client";

import { TableCellText } from "../table-cell-text";

type ReportMonitor =
  RouterOutputs["monitorReporting"]["report"]["monitors"][number];

function Duration({ ms }: { ms: number | null }) {
  return (
    <span className="block text-right font-mono tabular-nums">
      {ms === null ? "—" : formatSlaDuration(ms)}
    </span>
  );
}

const right = { headerClassName: "text-right" };

export const columns: ColumnDef<ReportMonitor>[] = [
  {
    accessorKey: "name",
    header: "Monitor",
    cell: ({ row }) => (
      <div className="grid min-w-0">
        <TableCellText value={row.original.name} className="font-medium" />
        <TableCellText
          value={row.original.url}
          className="text-muted-foreground truncate font-mono text-xs"
        />
      </div>
    ),
    meta: { cellClassName: "max-w-64 min-w-36" },
  },
  {
    id: "down",
    header: "Down",
    cell: ({ row }) => <Duration ms={row.original.downMs} />,
    meta: right,
  },
  {
    id: "slow",
    header: "Slow",
    cell: ({ row }) => <Duration ms={row.original.slowMs} />,
    meta: right,
  },
  {
    id: "excused",
    header: "Excused",
    cell: ({ row }) => <Duration ms={row.original.excusedMs} />,
    meta: right,
  },
  {
    id: "unmeasured",
    header: "Unmeasured",
    cell: ({ row }) => <Duration ms={row.original.unmeasuredMs} />,
    meta: right,
  },
  {
    id: "maintenance",
    header: "During maintenance",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.maintenanceMode === "pause"
          ? "Checks pause"
          : "Checks continue"}
      </span>
    ),
  },
];
