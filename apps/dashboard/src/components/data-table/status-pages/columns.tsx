"use client";

import { Link } from "@/components/common/link";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

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
    accessorKey: "icon",
    header: "Favicon",
    cell: ({ row }) => {
      const value = row.getValue("icon");
      if (!value || typeof value !== "string")
        return <span className="text-muted-foreground">-</span>;
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
    cell: ({ row }) => {
      const domain = row.getValue("domain");
      const slug = row.getValue("slug");
      return (
        <TableCellLink
          href={domain ? `https://${domain}` : `https://${slug}.openstatus.dev`}
          value={slug}
        />
      );
    },
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
      const value = row.getValue("domain");
      if (typeof value !== "string")
        return <span className="text-muted-foreground">-</span>;
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
