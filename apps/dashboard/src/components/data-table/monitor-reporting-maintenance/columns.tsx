"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@/components/common/link";

import { TableCellEmpty } from "../table-cell-empty";
import { TableCellLink } from "../table-cell-link";

type PolicyMonitor =
  RouterOutputs["monitorReporting"]["maintenances"]["monitors"][number];

export const columns: ColumnDef<PolicyMonitor>[] = [
  {
    accessorKey: "name",
    header: "Monitor",
    cell: ({ row }) => (
      <TableCellLink
        value={row.original.name}
        href={`/monitors/${row.original.id}/overview`}
        className="font-medium"
      />
    ),
    meta: { cellClassName: "max-w-56 min-w-36" },
  },
  {
    accessorKey: "maintenanceMode",
    header: "During maintenance",
    cell: ({ row }) =>
      row.original.maintenanceMode === "pause" ? (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-warning">Checks pause</span>
          <Link
            href={`/monitors/${row.original.id}/edit#maintenance`}
            className="text-muted-foreground text-xs"
          >
            Change
          </Link>
        </span>
      ) : (
        <span>Checks continue</span>
      ),
  },
  {
    id: "statusPages",
    header: "Status pages",
    cell: ({ row }) => {
      const pages = row.original.statusPages;
      if (pages.length === 0) return <TableCellEmpty />;
      return (
        <span className="flex flex-wrap gap-x-2">
          {pages.map((p) => (
            <Link key={p.id} href={`/status-pages/${p.id}/maintenances`}>
              {p.title}
            </Link>
          ))}
        </span>
      );
    },
  },
];
