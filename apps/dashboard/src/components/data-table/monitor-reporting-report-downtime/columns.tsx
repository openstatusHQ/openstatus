"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import {
  formatExcusedWindow,
  formatSlaDuration,
} from "@/data/reportings.client";

import { TableCellText } from "../table-cell-text";

type Stretch =
  RouterOutputs["monitorReporting"]["report"]["downtime"]["items"][number];

export function getColumns({
  timeZone,
}: {
  timeZone: string;
}): ColumnDef<Stretch>[] {
  return [
    {
      id: "when",
      header: `When (${timeZone})`,
      cell: ({ row }) => (
        <span className="font-mono text-sm whitespace-nowrap tabular-nums">
          {formatExcusedWindow(
            row.original.startedAt,
            row.original.endedAt,
            timeZone,
          )}
        </span>
      ),
    },
    {
      id: "monitor",
      header: "Monitor",
      cell: ({ row }) => <TableCellText value={row.original.monitor.name} />,
      meta: { cellClassName: "max-w-56 whitespace-normal" },
    },
    {
      id: "kind",
      header: "What",
      cell: ({ row }) =>
        row.original.kind === "error" ? (
          <span className="text-destructive">Down</span>
        ) : row.original.treatment === "counted" ? (
          <span className="text-destructive">Slow, counted as down</span>
        ) : (
          <span className="text-muted-foreground">Slow, counted as up</span>
        ),
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <span className="block text-right font-mono tabular-nums">
          {formatSlaDuration(row.original.durationMs)}
        </span>
      ),
      meta: { headerClassName: "text-right" },
    },
  ];
}
