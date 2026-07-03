"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  type HistoryRow,
  type HistoryWindow,
  eventsForMonth,
  monthKeyToFullLabel,
  monthKeyToLabel,
  windowKey,
} from "@/data/status-page-history";
import { cn } from "@/lib/utils";

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
          {c.type === "monitor" ? "Monitor" : "Static"}
        </span>
      </div>
    );
  },
  meta: {
    cellClassName: "min-w-[180px] max-w-[240px]",
    headerClassName: "max-w-[240px]",
  },
};

// `months` comes oldest-first from the server; column ids stay slot-based
// (1 = current) so the window visibility toggle keeps working
function monthColumns(months: string[]): ColumnDef<HistoryRow>[] {
  return months.map((key, i) => {
    const offset = months.length - i;
    const isCurrent = offset === 1;
    return {
      id: String(offset),
      accessorFn: (row: HistoryRow) => row.months[key],
      header: () => (
        <span className={cn("block text-center", isCurrent && "text-info")}>
          {monthKeyToLabel(key)}
        </span>
      ),
      cell: ({ row }: { row: { original: HistoryRow } }) => (
        <TableCellUptime
          percentage={row.original.months[key] ?? null}
          isCurrent={isCurrent}
          monthLabel={monthKeyToFullLabel(key)}
          events={eventsForMonth(row.original.events, key)}
          monitorId={row.original.component.monitorId}
        />
      ),
      enableSorting: false,
      meta: { cellClassName: "p-1", headerClassName: "text-center" },
    };
  });
}

function rollingColumn(window: HistoryWindow): ColumnDef<HistoryRow> {
  return {
    id: "rolling",
    accessorFn: (row) => row.rolling[windowKey(window)],
    header: "Total",
    cell: ({ row }) => {
      const value = row.original.rolling[windowKey(window)];
      return value === null ? "–" : `${value.toFixed(2)}%`;
    },
    enableSorting: false,
    meta: {
      headerClassName: "text-center tabular-nums",
      cellClassName: "text-center font-medium font-mono text-xs",
    },
  };
}

export function getColumns(
  months: string[],
  window: HistoryWindow,
): ColumnDef<HistoryRow>[] {
  return [componentColumn, ...monthColumns(months), rollingColumn(window)];
}
