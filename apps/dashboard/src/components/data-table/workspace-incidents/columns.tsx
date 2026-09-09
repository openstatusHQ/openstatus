"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";

type Incident = NonNullable<RouterOutputs["incident"]["list"]>[number];

const SEVERITY_VARIANT = {
  critical: "destructive",
  warning: "default",
  info: "secondary",
} as const;

const ORIGIN_LABEL = {
  monitor: "Monitor",
  external: "Ingested",
  manual: "Manual",
} as const;

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <TableCellLink
        value={row.getValue("title")}
        href={`/incidents/${row.original.id}`}
      />
    ),
    meta: { cellClassName: "max-w-[280px] min-w-max" },
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => {
      const severity = row.original.severity;
      return <Badge variant={SEVERITY_VARIANT[severity]}>{severity}</Badge>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    accessorKey: "origin",
    header: "Origin",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {ORIGIN_LABEL[row.original.origin]}
      </span>
    ),
  },
  {
    accessorKey: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("startedAt")} />,
  },
  {
    accessorKey: "resolvedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Resolved" />
    ),
    cell: ({ row }) =>
      row.original.resolvedAt ? (
        <TableCellDate value={row.original.resolvedAt} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "published",
    header: "Published",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.statusReportId ? (
        <Badge variant="secondary">Status report</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];
