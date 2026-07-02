"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "@/lib/utils";

import {
  type HistoryRow,
  HISTORY_WINDOW_MONTHS,
  offsetToFullLabel,
  offsetToKey,
  offsetToLabel,
} from "./data";
import { TableCellUptime } from "./table-cell-uptime";

const componentColumn: ColumnDef<HistoryRow> = {
  id: "component",
  accessorFn: (row) => row.component.name,
  header: "Component",
  cell: ({ row }) => {
    const c = row.original.component;
    return (
      <div className="flex flex-col">
        <span className="truncate font-medium">{c.name}</span>
        <span className="text-muted-foreground text-xs">
          {c.kind} · {c.basis}
        </span>
      </div>
    );
  },
  meta: {
    cellClassName: "min-w-[180px] max-w-[240px]",
    headerClassName: "max-w-[240px]",
  },
};

// Slot 24 (oldest) → 1 (current), oldest-first. Ids are stable; labels/buckets slide monthly.
const monthColumns: ColumnDef<HistoryRow>[] = Array.from(
  { length: HISTORY_WINDOW_MONTHS },
  (_, i) => {
    const offset = HISTORY_WINDOW_MONTHS - i;
    const isCurrent = offset === 1;
    const key = offsetToKey(offset);
    return {
      id: String(offset),
      accessorFn: (row) => row.buckets[key],
      header: () => (
        <span className={cn("block text-center", isCurrent && "text-info")}>
          {offsetToLabel(offset)}
        </span>
      ),
      cell: ({ row }) => (
        <TableCellUptime
          cell={row.original.buckets[key]}
          isCurrent={isCurrent}
          monthLabel={offsetToFullLabel(offset)}
          component={row.original.component}
        />
      ),
      enableSorting: false,
      meta: { cellClassName: "p-1", headerClassName: "text-center" },
    };
  },
);

function rolling(row: HistoryRow, window: 6 | 12 | 24): number {
  return window === 24
    ? row.rolling24
    : window === 12
      ? row.rolling12
      : row.rolling6;
}

function rollingColumn(window: 6 | 12 | 24): ColumnDef<HistoryRow> {
  return {
    id: "rolling",
    accessorFn: (row) => rolling(row, window),
    header: "Total",
    cell: ({ row }) => `${rolling(row.original, window).toFixed(2)}%`,
    enableSorting: false,
    meta: {
      headerClassName: "text-center tabular-nums",
      cellClassName: "text-center font-medium font-mono text-xs",
    },
  };
}

export function getColumns(window: 6 | 12 | 24): ColumnDef<HistoryRow>[] {
  return [componentColumn, ...monthColumns, rollingColumn(window)];
}
