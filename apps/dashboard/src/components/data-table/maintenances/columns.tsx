"use client";

import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { Maintenance } from "@/data/maintenances";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";
import { formatDistanceStrict } from "date-fns";
import { TableCellNumber } from "@/components/data-table/table-cell-number";

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
        <div className="text-muted-foreground max-w-[200px] truncate">
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
    accessorFn: (row) => formatDistanceStrict(row.startDate, row.endDate),
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
