"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { ScopeBadge } from "@/components/common/scope-badge";
import { formatDate } from "@/lib/formatter";

import { TableCellEmpty } from "../../table-cell-empty";
import { DataTableRowActions } from "./data-table-row-actions";

type ApiKey = RouterOutputs["apiKey"]["list"][number];

export const columns: ColumnDef<ApiKey>[] = [
  {
    accessorKey: "name",
    header: "Name",
    meta: { cellClassName: "font-medium" },
  },
  {
    accessorKey: "description",
    header: "Description",
    meta: { cellClassName: "text-muted-foreground max-w-[200px] truncate" },
    cell: ({ row }) =>
      row.original.description ? (
        row.original.description
      ) : (
        <TableCellEmpty>No description</TableCellEmpty>
      ),
  },
  {
    accessorKey: "prefix",
    header: "Prefix",
    cell: ({ row }) => (
      <code className="text-xs">{row.original.prefix}...</code>
    ),
  },
  {
    accessorKey: "scopes",
    header: "Access",
    cell: ({ row }) => <ScopeBadge scopes={row.original.scopes} />,
  },
  {
    accessorKey: "expiresAt",
    header: "Expires",
    meta: { cellClassName: "text-sm" },
    cell: ({ row }) =>
      row.original.expiresAt ? (
        formatDate(row.original.expiresAt)
      ) : (
        <TableCellEmpty>Never</TableCellEmpty>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { ghost: false },
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
