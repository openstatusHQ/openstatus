"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { formatDate } from "@/lib/formatter";

import { TableCellEmpty } from "../../table-cell-empty";
import { DataTableRowActions } from "./data-table-row-actions";

type Invitation = RouterOutputs["invitation"]["list"][number];

export const columns: ColumnDef<Invitation>[] = [
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) =>
      row.original.createdAt ? (
        formatDate(row.original.createdAt)
      ) : (
        <TableCellEmpty>Unknown</TableCellEmpty>
      ),
  },
  {
    accessorKey: "expiresAt",
    header: "Expires At",
    cell: ({ row }) => formatDate(row.original.expiresAt),
  },
  {
    accessorKey: "acceptedAt",
    header: "Accepted At",
    cell: ({ row }) =>
      row.original.acceptedAt ? (
        formatDate(row.original.acceptedAt)
      ) : (
        <TableCellEmpty>Pending</TableCellEmpty>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
