"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
} from "@/components/incidents/incident-badge";

type ManagedIncident = NonNullable<RouterOutputs["incident"]["list"]>[number];

export const columns: ColumnDef<ManagedIncident>[] = [
  {
    accessorKey: "severity",
    header: "Severity",
    enableSorting: false,
    cell: ({ row }) => (
      <IncidentSeverityBadge severity={row.original.severity} />
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: false,
    cell: ({ row }) => (
      <TableCellLink
        href={`/incidents/${row.original.id}`}
        value={row.original.title}
      />
    ),
    meta: { cellClassName: "max-w-[260px] truncate" },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <IncidentStatusBadge
        status={row.original.status}
        closed={row.original.closedAt !== null}
      />
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
];
