"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Invitation, WorkspaceRole } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui/src/components/badge";

import { formatDate } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";

// TODO: add total number of monitors

export const columns: ColumnDef<Invitation>[] = [
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as WorkspaceRole;
      return (
        <Badge variant={role === "member" ? "outline" : "default"}>
          {row.getValue("role")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "expiresAt",
    header: "Expires at",
    cell: ({ row }) => {
      return <span>{formatDate(row.getValue("expiresAt"))}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <div className="text-right">
          <DataTableRowActions row={row} />
        </div>
      );
    },
  },
];
