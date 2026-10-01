"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";

import { Link } from "@/components/common/link";
import { TableCellBadge } from "@/components/data-table/table-cell-badge";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";

import { DataTableRowActions } from "./data-table-row-actions";

type Maintenance = RouterOutputs["maintenance"]["list"][number];

export const columns: ColumnDef<Maintenance>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const { id, pageId } = row.original;
      return (
        <TableCellLink
          href={`/status-pages/${pageId}/maintenances/${id}`}
          value={row.getValue("title")}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] truncate",
    },
  },
  {
    id: "pageComponents",
    accessorFn: (row) => row.pageComponents,
    header: "Affected",
    enableSorting: false,
    cell: ({ row }) => {
      const value = row.original.pageComponents;
      if (value.length === 0) {
        return <div className="text-muted-foreground">-</div>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((c) =>
            c.monitorId ? (
              <Link href={`/monitors/${c.monitorId}/overview`} key={c.id}>
                <TableCellBadge value={c.name} />
              </Link>
            ) : (
              <TableCellBadge value={c.name} key={c.id} />
            ),
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "from",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start Date" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("from")} />,
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
    meta: {
      cellClassName: "w-8",
    },
  },
];
