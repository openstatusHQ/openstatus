"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { useStatusPageBaseDomain } from "@/components/deployment-config-provider";
import { getStatusPageUrl } from "@/lib/deployment-config";

import { TableCellEmpty } from "../table-cell-empty";
import { DataTableRowActions } from "./data-table-row-actions";

type StatusPage = RouterOutputs["page"]["list"][number];

// A component (not an inline cell function) so it can read the runtime base
// domain from context.
function SlugCell({ slug, domain }: { slug: string; domain?: string | null }) {
  const statusPageBaseDomain = useStatusPageBaseDomain();
  return (
    <TableCellLink
      href={getStatusPageUrl(
        { slug, customDomain: domain },
        statusPageBaseDomain,
      )}
      value={slug}
    />
  );
}

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
        return <TableCellEmpty>No favicon</TableCellEmpty>;
      return (
        <img
          src={`${value}`}
          alt={`Favicon for ${row.getValue("title")}`}
          className="bg-muted h-4 w-4 rounded border"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => (
      <SlugCell slug={row.original.slug} domain={row.original.customDomain} />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    accessorKey: "domain",
    accessorFn: (row) => row.customDomain,
    header: "Domain",
    cell: ({ row }) => {
      const value = row.getValue("domain");
      if (typeof value !== "string")
        return <TableCellEmpty>No domain</TableCellEmpty>;
      return <TableCellText value={value} className="font-mono" />;
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
