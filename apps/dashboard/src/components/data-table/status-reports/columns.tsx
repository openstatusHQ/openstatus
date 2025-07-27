"use client";

import { TableCellBadge } from "@/components/data-table/table-cell-badge";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { colors } from "@/data/status-report-updates.client";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DataTableRowActions } from "./data-table-row-actions";

import type { RouterOutputs } from "@openstatus/api";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

export const columns: ColumnDef<StatusReport>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <Button
          {...{
            className: "size-7 shadow-none text-muted-foreground",
            onClick: (e) => {
              e.stopPropagation();
              row.toggleExpanded();
            },
            "aria-expanded": row.getIsExpanded(),
            "aria-label": row.getIsExpanded()
              ? `Collapse details for ${row.original.title}`
              : `Expand details for ${row.original.title}`,
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
    accessorKey: "title",
    header: "Title",
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: "Current Status",
    cell: ({ row }) => {
      const value = String(row.getValue("status"));
      return (
        <div
          className={cn(
            "font-mono capitalize",
            colors[value as keyof typeof colors],
          )}
        >
          {value}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "updates",
    accessorFn: (row) => row.updates.length,
    header: "Total Updates",
    cell: ({ row }) => {
      const value = row.getValue("updates");
      return <TableCellNumber value={value} />;
    },
  },
  {
    id: "monitors",
    accessorFn: (row) => row.monitors,
    header: "Affected",
    cell: ({ row }) => {
      const value = row.getValue("monitors");
      if (Array.isArray(value) && value.length > 0 && "name" in value[0]) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((m) => (
              <TableCellBadge key={m.id} value={m.name} />
            ))}
          </div>
        );
      }
      return <div className="text-muted-foreground">-</div>;
    },
  },
  {
    id: "startedAt",
    accessorFn: (row) =>
      row.updates.sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date,
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
