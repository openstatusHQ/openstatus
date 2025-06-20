"use client";

import { Link } from "@/components/common/link";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";
import type { RouterOutputs } from "@openstatus/api";

type StatusPage = RouterOutputs["page"]["list"][number];

export const columns: ColumnDef<StatusPage>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return (
        <TableCellLink
          href={`/status-pages/${row.original.id}/status-reports`}
          value={row.getValue("title")}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
  },
  {
    accessorKey: "favicon",
    header: "Favicon",
    cell: ({ row }) => {
      const value = row.getValue("favicon");
      if (!value) return "-";
      return (
        <img
          src={`${value}`}
          alt={`Favicon for ${row.getValue("name")}`}
          className="h-4 w-4 rounded border bg-muted"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    accessorKey: "domain",
    header: "Domain",
    cell: ({ row }) => {
      const value = String(row.getValue("domain"));
      return (
        <Link href={"#"} className="font-mono">
          {value}
        </Link>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
