"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import {
  excusedKindLabels,
  formatExcusedWindow,
  formatSlaDuration,
} from "@/data/reportings.client";

import { TableCellText } from "../table-cell-text";

type ExcusedWindow =
  RouterOutputs["monitorReporting"]["report"]["excusedWindows"][number];

export function getColumns({
  timeZone,
}: {
  timeZone: string;
}): ColumnDef<ExcusedWindow>[] {
  return [
    {
      id: "window",
      header: `Window (${timeZone})`,
      cell: ({ row }) => (
        <span className="font-mono text-sm whitespace-nowrap tabular-nums">
          {formatExcusedWindow(row.original.from, row.original.to, timeZone)}
        </span>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {excusedKindLabels[row.original.kind]}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => <TableCellText value={row.original.reason} />,
      meta: { cellClassName: "min-w-64 whitespace-normal" },
    },
    {
      id: "duration",
      header: "In this month",
      cell: ({ row }) => (
        <span className="block text-right font-mono tabular-nums">
          {formatSlaDuration(row.original.durationMs)}
        </span>
      ),
      meta: { headerClassName: "text-right" },
    },
  ];
}
