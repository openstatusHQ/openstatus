"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";
import {
  excusedKindLabels,
  formatExcusedWindow,
} from "@/data/reportings.client";
import { formatDurationShort } from "@/lib/formatter";

import { TableCellText } from "../table-cell-text";
import { DataTableRowActions } from "./data-table-row-actions";

export type ExcusedWindow =
  RouterOutputs["monitorReporting"]["get"]["excusedWindows"][number];

const kindVariant: Record<
  ExcusedWindow["kind"],
  "info" | "warning" | "destructive" | "default"
> = {
  maintenance: "info",
  emergency: "warning",
  third_party: "default",
  customer_caused: "default",
  force_majeure: "destructive",
  other: "default",
};

export function getColumns({
  readOnly,
  timeZone,
}: {
  readOnly: boolean;
  /** the reporting's zone: windows read in the months they excuse */
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
        <StatusBadge variant={kindVariant[row.original.kind]}>
          {excusedKindLabels[row.original.kind]}
        </StatusBadge>
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
      header: "Duration",
      cell: ({ row }) => (
        <span className="block text-right font-mono tabular-nums">
          {formatDurationShort(
            row.original.to.getTime() - row.original.from.getTime(),
          )}
        </span>
      ),
      meta: { headerClassName: "text-right" },
    },
    {
      id: "createdBy",
      header: "Added by",
      cell: ({ row }) => (
        <TableCellText
          value={row.original.createdBy?.name}
          className="text-muted-foreground whitespace-nowrap"
        />
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => <DataTableRowActions row={row} readOnly={readOnly} />,
      meta: { cellClassName: "w-10" },
    },
  ];
}
