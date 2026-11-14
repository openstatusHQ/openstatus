"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { formatExcusedWindow } from "@/data/reportings.client";

import { TableCellText } from "../table-cell-text";

type Maintenance =
  RouterOutputs["monitorReporting"]["report"]["maintenances"][number];

export function getColumns({
  timeZone,
}: {
  timeZone: string;
}): ColumnDef<Maintenance>[] {
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
      accessorKey: "title",
      header: "Maintenance",
      cell: ({ row }) => (
        <div className="grid min-w-0">
          <TableCellText value={row.original.title} />
          <TableCellText
            value={row.original.pageTitle}
            className="text-muted-foreground text-xs"
          />
        </div>
      ),
      meta: { cellClassName: "min-w-48 whitespace-normal" },
    },
    {
      id: "monitors",
      header: "Monitors",
      cell: ({ row }) => (
        <ul className="grid gap-0.5">
          {row.original.monitors.map((m) => (
            <li key={m.id}>
              {m.name}{" "}
              <span className="text-muted-foreground">
                {m.maintenanceMode === "pause"
                  ? "· checks pause"
                  : "· checks continue"}
              </span>
            </li>
          ))}
        </ul>
      ),
      meta: { cellClassName: "whitespace-normal" },
    },
  ];
}
