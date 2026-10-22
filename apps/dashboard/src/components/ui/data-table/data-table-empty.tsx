"use client";

import { Filter } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { TableCell, TableRow } from "@openstatus/ui/components/ui/table";
import type { Table } from "@tanstack/react-table";

import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { cn } from "@/lib/utils";

// pill widths cycle per cell so the ghost rows read as rows, not a grid
const GHOST_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-1/3", "w-2/5"];
const GHOST_ROWS = 5;
// rows are h-10; the empty state pulls itself up by this much
const GHOST_HEIGHT = `${GHOST_ROWS * 2.5}rem`;

/** Real table rows, so the ghost cells share the header column widths. */
export function DataTableGhostRows<TData>({ table }: { table: Table<TData> }) {
  const columns = table.getVisibleLeafColumns();
  // TanStack fills in a header for every column; only labeled ones get a pill
  const defaultHeader = table._getDefaultColumnDef().header;
  const labeled = (column: (typeof columns)[number]) =>
    column.columnDef.meta?.ghost !== false &&
    column.columnDef.header !== defaultHeader &&
    column.columnDef.header !== "";
  return Array.from({ length: GHOST_ROWS }).map((_, row) => (
    <TableRow key={row} aria-hidden className="h-10 hover:bg-transparent">
      {columns.map((column, cell) => (
        <TableCell
          key={column.id}
          className={column.columnDef.meta?.cellClassName}
        >
          {labeled(column) ? (
            <Skeleton
              className={cn(
                // inline so the cell's text alignment positions the pill
                "inline-block h-4 animate-none align-middle",
                GHOST_WIDTHS[(row + cell) % GHOST_WIDTHS.length],
              )}
            />
          ) : null}
        </TableCell>
      ))}
    </TableRow>
  ));
}

/** First-run body, pulled up over the ghost rows the table renders. */
export function DataTableEmpty({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-empty"
      className={cn(
        "relative -mt-(--ghost-height)",
        // overlay fading the ghost rows out towards the content
        "before:via-background before:to-background before:absolute before:inset-x-0 before:top-0 before:h-(--ghost-height) before:bg-gradient-to-b before:from-transparent before:via-70%",
        className,
      )}
      style={{ "--ghost-height": GHOST_HEIGHT } as React.CSSProperties}
      {...props}
    >
      <EmptyStateContainer plain className="relative py-14">
        {children}
      </EmptyStateContainer>
    </div>
  );
}

/** Rows exist but the filters match none of them. */
export function DataTableEmptyFiltered<TData>({
  table,
}: {
  table: Table<TData>;
}) {
  return (
    <EmptyStateContainer inline plain className="px-4">
      <EmptyStateMedia>
        <Filter />
      </EmptyStateMedia>
      <EmptyStateTitle>No matches</EmptyStateTitle>
      <EmptyStateDescription>
        Nothing matches the current filters.
      </EmptyStateDescription>
      <EmptyStateActions>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            table.resetColumnFilters();
            table.resetGlobalFilter();
          }}
        >
          Clear filters
        </Button>
      </EmptyStateActions>
    </EmptyStateContainer>
  );
}
