"use client";

import { getColumns } from "@/components/data-table/response-logs/columns";
import { Sheet } from "@/components/data-table/response-logs/data-table-sheet";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { cn } from "@openstatus/ui/lib/utils";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";

// Use the wider `get`-shape so the row also satisfies the Sheet's input.
// The column defs are typed against `list` shape, but every list field
// is also present on `get`, so casting is safe.
export type OnboardingChecksRow =
  RouterOutputs["tinybird"]["get"]["data"][number];

const COLUMNS = getColumns([]) as unknown as ColumnDef<OnboardingChecksRow>[];

export function OnboardingChecksTable({
  rows,
  totalRegions,
  isStreaming,
  allFailed,
  url,
  onRetry,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  rows: OnboardingChecksRow[];
  totalRegions: number;
  isStreaming: boolean;
  allFailed: boolean;
  url?: string;
  onRetry: () => void;
}) {
  // Track selection by row id so new rows arriving via streaming don't
  // make the Sheet point at a stale object reference.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: { trigger: false },
    },
  });

  const selected =
    selectedId == null ? null : rows.find((r) => r.id === selectedId) ?? null;

  if (allFailed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-md border border-border bg-muted/30 p-6 text-center",
          className,
        )}
        {...props}
      >
        <AlertTriangle className="size-5 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-foreground text-sm">
            Couldn&apos;t reach {url ? <code>{url}</code> : "your URL"}
          </p>
          <p className="text-muted-foreground text-xs">
            Common causes: the URL is internal, blocks our checkers, or has a
            typo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && isStreaming) {
    return (
      <div
        className={cn(
          "overflow-auto rounded-md border border-border bg-background md:min-h-0 md:flex-1",
          className,
        )}
        {...props}
      >
        <DataTableSkeleton rows={Math.min(totalRegions, 8)} />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "overflow-auto rounded-md border border-border bg-background md:min-h-0 md:flex-1",
          className,
        )}
        {...props}
      >
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(row.original.id ?? null)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      (
                        cell.column.columnDef.meta as
                          | { cellClassName?: string }
                          | undefined
                      )?.cellClassName,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {isStreaming && rows.length < totalRegions ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="text-center text-muted-foreground text-xs"
                >
                  Streaming results from {totalRegions - rows.length} more
                  region{totalRegions - rows.length === 1 ? "" : "s"}…
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </table>
      </div>
      <Sheet
        data={selected}
        onClose={() => setSelectedId(null)}
        showCopyUrl={false}
      />
    </>
  );
}
