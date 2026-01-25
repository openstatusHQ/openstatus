"use client";

import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

type PageComponent = RouterOutputs["pageComponent"]["list"][number];

export const columns: ColumnDef<PageComponent>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "description",
    header: "Description",
    enableSorting: false,
    cell: ({ row }) => {
      const value = row.getValue("description");
      return (
        <span className="max-w-[200px] truncate text-muted-foreground">
          {value ? String(value) : "-"}
        </span>
      );
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("type");
      return <span className="capitalize">{String(value)}</span>;
    },
  },
  {
    accessorKey: "order",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("order");
      return <span>{value != null ? String(value) : "-"}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
