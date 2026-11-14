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
