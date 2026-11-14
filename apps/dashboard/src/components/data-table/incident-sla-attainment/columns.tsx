"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

import { formatSlaMonth } from "@/data/reportings.client";

import { TableCellEmpty } from "../table-cell-empty";
import { TableCellNumber } from "../table-cell-number";

type Month = NonNullable<
  RouterOutputs["incidentReporting"]["attainment"]
>["months"][number];
type Count = Month["response"];

function TargetCell({ count }: { count: Count }) {
  if (count.total === 0) {
    return <TableCellEmpty className="font-mono">—</TableCellEmpty>;
  }
  return (
    <div className="font-mono tabular-nums">
      <span
        className={count.missed > 0 ? "text-destructive" : "text-foreground"}
      >
        {count.within} of {count.total}
      </span>
      {count.open > 0 ? (
        <span className="text-muted-foreground block text-xs">
          {count.open} open
        </span>
      ) : null}
    </div>
  );
}

export const columns: ColumnDef<Month>[] = [
  {
    accessorKey: "month",
    header: "Month",
    cell: ({ row }) => (
      <div className="font-medium">
        {formatSlaMonth(row.original.month, { year: true })}
      </div>
    ),
  },
  {
    accessorKey: "incidents",
    header: "Incidents",
    cell: ({ row }) => (
      <TableCellNumber
        value={row.original.incidents || Number.NaN}
        className="tabular-nums"
      />
    ),
  },
  {
    id: "response",
    header: "Responded within target",
    cell: ({ row }) => <TargetCell count={row.original.response} />,
  },
  {
    id: "resolution",
    header: "Resolved within target",
    cell: ({ row }) => <TargetCell count={row.original.resolution} />,
  },
  {
    accessorKey: "missedUpdates",
    header: "Missed updates",
    cell: ({ row }) => {
      const { incidents, missedUpdates } = row.original;
      return (
        <TableCellNumber
          value={incidents === 0 ? Number.NaN : missedUpdates}
          variant={missedUpdates > 0 ? "destructive" : "default"}
          className="tabular-nums"
        />
      );
    },
  },
  {
    id: "credit",
    header: "Support credit",
    cell: ({ row }) => {
      const { creditPct, misses } = row.original;
      if (creditPct === null) {
        return <TableCellEmpty className="font-mono">—</TableCellEmpty>;
      }
      return (
        <div className="font-mono tabular-nums">
          <span className={misses > 0 ? "text-destructive" : "text-foreground"}>
            {creditPct}%
          </span>
          {misses > 0 ? (
            <span className="text-muted-foreground block text-xs">
              {misses} {misses === 1 ? "miss" : "misses"}
            </span>
          ) : null}
        </div>
      );
    },
  },
];
