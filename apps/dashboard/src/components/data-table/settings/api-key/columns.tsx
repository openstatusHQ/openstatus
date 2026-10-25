"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";

import { formatDate } from "@/lib/formatter";

import { TableCellEmpty } from "../../table-cell-empty";
import { DataTableRowActions } from "./data-table-row-actions";

type ApiKey = RouterOutputs["apiKey"]["list"][number];

/**
 * Map a key's `scopes` array to a single human label. v1 keys carry one
 * value (`['read']` or `['write']`); legacy rows backfilled to
 * `['write']` show as "Read & write." `'*'` is super-admin (synthesized
 * by middleware, never settable through any public API). Seeing it on
 * a row indicates someone hand-edited the DB or a bug bypassed the
 * input enum — surface drift instead of silently mislabeling it.
 */
function scopeLabel(scopes: ApiKey["scopes"]): string {
  if (scopes.includes("*")) {
    if (typeof console !== "undefined") {
      console.warn(
        "[api-key table] row carries '*' scope — should never happen via the public API",
      );
    }
    return "Admin";
  }
  if (scopes.includes("write")) return "Read & write";
  if (scopes.includes("read")) return "Read-only";
  return "Unknown";
}

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
    cell: ({ row }) => (
      <Badge variant="secondary">{scopeLabel(row.original.scopes)}</Badge>
    ),
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
