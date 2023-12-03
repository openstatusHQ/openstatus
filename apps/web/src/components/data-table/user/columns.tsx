"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { User } from "@openstatus/db/src/schema";

import { formatDate } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";

// TODO: add total number of monitors

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      return (
        <div>
          <p>
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="text-muted-foreground">{row.getValue("email")}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      return <span>{formatDate(row.getValue("createdAt"))}</span>;
    },
  },
  // {
  //   id: "actions",
  //   cell: ({ row }) => {
  //     return (
  //       <div className="text-right">
  //         <DataTableRowActions row={row} />
  //       </div>
  //     );
  //   },
  // },
];
