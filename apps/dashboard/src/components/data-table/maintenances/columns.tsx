"use client";

import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";
import { DataTableRowActions } from "./data-table-row-actions";
import type { RouterOutputs } from "@openstatus/api";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

export const columns: ColumnDef<Maintenance>[] = [
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "message",
    header: "Message",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = String(row.getValue("message"));
      return (
        <div className="max-w-[200px] truncate text-muted-foreground">
          {value}
        </div>
      );
    },
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start Date" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("startDate");
      if (value instanceof Date) {
        return (
          <div className="text-muted-foreground">{value.toLocaleString()}</div>
        );
      }
      if (typeof value === "string") {
        return <div className="text-muted-foreground">{value}</div>;
      }
      return <div className="text-muted-foreground">-</div>;
    },
    enableHiding: false,
  },
  {
    id: "duration",
    accessorFn: (row) => formatDistanceStrict(row.from, row.to),
    header: "Duration",
    cell: ({ row }) => {
      const value = row.getValue("duration");
      if (typeof value === "string") {
        const [amount, unit] = value.split(" ");
        return <TableCellNumber value={amount} unit={unit} />;
      }
      return <TableCellNumber value={value} />;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
