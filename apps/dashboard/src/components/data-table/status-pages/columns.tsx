"use client";

import { Link } from "@/components/common/link";
import type { StatusPage } from "@/data/status-pages";
import type { ColumnDef } from "@tanstack/react-table";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<StatusPage>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <TableCellLink
          href={"status-pages/status-reports"}
          value={row.getValue("name")}
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
      const value = String(row.getValue("favicon"));
      return (
        <img
          src={value}
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
  },
];
