"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";

import { formatDate } from "@/lib/formatter";

import { TableCellEmpty } from "../../table-cell-empty";
import { DataTableRowActions } from "./data-table-row-actions";

type Grant = RouterOutputs["oauth"]["listGrants"][number];

function scopeLabel(scope: Grant["scope"]): string {
  return scope.includes("write") ? "Read & write" : "Read-only";
}

function userLabel(user: Grant["user"]): string {
  if (!user) return "Removed user";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email || `User ${user.id}`;
}

export const columns: ColumnDef<Grant>[] = [
  {
    accessorKey: "clientName",
    header: "App",
    meta: { cellClassName: "font-medium" },
  },
  {
    accessorKey: "scope",
    header: "Access",
    cell: ({ row }) => (
      <Badge variant="secondary">{scopeLabel(row.original.scope)}</Badge>
    ),
  },
  {
    id: "user",
    header: "Connected by",
    meta: { cellClassName: "text-muted-foreground max-w-[200px] truncate" },
    cell: ({ row }) => userLabel(row.original.user),
  },
  {
    accessorKey: "createdAt",
    header: "Connected",
    meta: { cellClassName: "text-sm" },
    cell: ({ row }) =>
      row.original.createdAt ? (
        formatDate(row.original.createdAt)
      ) : (
        <TableCellEmpty>Unknown</TableCellEmpty>
      ),
  },
  {
    accessorKey: "lastUsedAt",
    header: "Last used",
    meta: { cellClassName: "text-sm" },
    cell: ({ row }) =>
      row.original.lastUsedAt ? (
        formatDate(row.original.lastUsedAt)
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
