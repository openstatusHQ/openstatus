"use client";

import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { StatusReport } from "@/data/status-reports";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DataTableRowActions } from "./data-table-row-actions";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { formatDistanceStrict } from "date-fns";
import { TableCellDate } from "@/components/data-table/table-cell-date";

export const columns: ColumnDef<StatusReport>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <Button
          {...{
            className: "size-7 shadow-none text-muted-foreground",
            onClick: row.getToggleExpandedHandler(),
            "aria-expanded": row.getIsExpanded(),
            "aria-label": row.getIsExpanded()
              ? `Collapse details for ${row.original.name}`
              : `Expand details for ${row.original.name}`,
            size: "icon",
            variant: "ghost",
          }}
        >
          {row.getIsExpanded() ? (
            <ChevronUp className="opacity-60" size={16} aria-hidden="true" />
          ) : (
            <ChevronDown className="opacity-60" size={16} aria-hidden="true" />
          )}
        </Button>
      ) : undefined;
    },
    meta: {
      headerClassName: "w-7",
    },
  },
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: "Current Status",
    cell: ({ row }) => {
      const value = String(row.getValue("status"));
      if (value === "operational") {
        return <div className="font-mono text-success">{value}</div>;
      }
      return <div className="font-mono text-muted-foreground">{value}</div>;
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "duration",
    accessorFn: (row) => {
      const resolvedAt = row.updates.find(
        (i) => i.status === "operational"
      )?.date;
      if (!resolvedAt) return null;
      return formatDistanceStrict(row.startedAt, resolvedAt);
    },
    header: "Duration",
    cell: ({ row }) => {
      const value = row.getValue("duration");
      if (typeof value === "string") {
        const [amount, unit] = value.split(" ");
        return <TableCellNumber value={amount} unit={unit} />;
      }
      if (value === null) {
        return <div className="font-mono text-destructive">Ongoing</div>;
      }
      return <TableCellNumber value={value} />;
    },
  },
  {
    accessorKey: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started At" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("startedAt")} />,
    enableHiding: false,
    meta: {
      cellClassName: "w-[170px]",
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
