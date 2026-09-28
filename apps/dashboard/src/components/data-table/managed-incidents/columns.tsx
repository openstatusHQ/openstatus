"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";

import { Link } from "@/components/common/link";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import {
  personName,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";
import { cn } from "@/lib/utils";

type ManagedIncident = NonNullable<RouterOutputs["incident"]["list"]>[number];

export const columns: ColumnDef<ManagedIncident>[] = [
  {
    accessorKey: "severity",
    header: "Severity",
    enableSorting: false,
    cell: ({ row }) => {
      const config = severityConfig[row.original.severity];
      return (
        <Badge variant="outline" className={cn("font-mono", config.className)}>
          {config.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/incidents/${row.original.id}`} className="font-medium">
        {row.original.title}
      </Link>
    ),
    meta: { cellClassName: "max-w-[260px] truncate" },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => {
      const config = statusConfig[row.original.status];
      return (
        <span className={cn("font-mono text-sm", config.className)}>
          {config.label}
          {row.original.closedAt && row.original.status !== "canceled"
            ? " · closed"
            : null}
        </span>
      );
    },
  },
  {
    id: "commander",
    header: "Commander",
    cell: ({ row }) => (
      <TableCellText value={personName(row.original.commander)} />
    ),
  },
  {
    accessorKey: "declaredAt",
    header: "Declared",
    cell: ({ row }) => <TableCellDate value={row.original.declaredAt} />,
  },
  {
    id: "duration",
    header: "Duration",
    cell: ({ row }) => {
      const end =
        row.original.status === "resolved" && row.original.resolvedAt
          ? row.original.resolvedAt
          : row.original.status === "canceled"
            ? row.original.closedAt
            : new Date();
      if (!end) return <TableCellText value={null} />;
      const [amount, unit] = formatDistanceStrict(
        row.original.startedAt,
        end,
      ).split(" ");
      return <TableCellNumber value={amount} unit={unit} />;
    },
  },
  {
    id: "statusReport",
    header: "Status report",
    cell: ({ row }) => (
      <TableCellText value={row.original.statusReport?.title ?? null} />
    ),
    meta: { cellClassName: "max-w-[200px] truncate" },
  },
];
