"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  type HistoryRow,
  eventsForMonth,
  monthKeyToFullLabel,
  monthKeyToLabel,
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

// `months` comes oldest-first from the server
function monthColumns(
  months: string[],
  timeZone: string,
  utcOnlyMonths: string[],
): ColumnDef<HistoryRow>[] {
  return months.map((key, i) => {
    const isCurrent = i === months.length - 1;
    const utcOnly = timeZone !== "UTC" && utcOnlyMonths.includes(key);
    // a UTC-only month annotates with the events of that UTC month
    const eventZone = utcOnly ? "UTC" : timeZone;
    return {
      id: key,
      accessorFn: (row: HistoryRow) => row.months[key]?.percentage ?? null,
      header: () => (
        <span className={cn("block text-center", isCurrent && "text-info")}>
          {monthKeyToLabel(key)}
          {utcOnly ? (
            <span className="text-muted-foreground block text-xs leading-none">
              UTC
            </span>
          ) : null}
        </span>
      ),
      cell: ({ row }: { row: { original: HistoryRow } }) => (
        <TableCellUptime
          value={row.original.months[key] ?? null}
          unit={row.original.unit}
          label={monthKeyToFullLabel(key)}
          isCurrent={isCurrent}
          events={eventsForMonth(row.original.events, key, eventZone)}
          maintenanceWindows={eventsForMonth(
            row.original.maintenanceWindows,
            key,
            eventZone,
          )}
          excusedOutages={eventsForMonth(
            row.original.excusedOutages,
            key,
            eventZone,
          )}
          monitorId={row.original.component.monitorId}
        />
      ),
      enableSorting: false,
      meta: { cellClassName: "p-1", headerClassName: "text-center" },
    };
  });
}

const totalColumn: ColumnDef<HistoryRow> = {
  id: "total",
  accessorFn: (row) => row.total?.percentage ?? null,
  header: "Total",
  cell: ({ row }) => (
    <TableCellUptime
      value={row.original.total}
      unit={row.original.unit}
      label="Last 12 months"
    />
  ),
  enableSorting: false,
  meta: {
    headerClassName: "text-center tabular-nums",
    cellClassName: "p-1",
  },
};

export function getColumns(
  months: string[],
  timeZone = "UTC",
  utcOnlyMonths: string[] = [],
): ColumnDef<HistoryRow>[] {
  return [
    componentColumn,
    ...monthColumns(months, timeZone, utcOnlyMonths),
    totalColumn,
  ];
}
