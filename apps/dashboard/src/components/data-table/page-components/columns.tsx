"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";

import { TableCellEmpty } from "../table-cell-empty";
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
      if (!value) return <TableCellEmpty>No description</TableCellEmpty>;
      return (
        <span className="text-muted-foreground max-w-[200px] truncate">
          {String(value)}
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
      if (value == null) return <TableCellEmpty>Unset</TableCellEmpty>;
      return <span>{String(value)}</span>;
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
