"use client";

import { Filter } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
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
const GHOST_COLUMNS = 5;

/** First-run body: static ghost rows fading out behind the empty state. */
export function DataTableEmpty({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-empty"
      className={cn("relative", className)}
      {...props}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 [mask-image:linear-gradient(to_bottom,black,transparent)] opacity-70"
      >
        {Array.from({ length: 3 }).map((_, row) => (
          <div
            key={row}
            className="grid h-10 items-center gap-4 border-b px-2"
            style={{
              gridTemplateColumns: `repeat(${GHOST_COLUMNS}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: GHOST_COLUMNS }).map((_, cell) => (
              <Skeleton
                key={cell}
                className={cn(
                  "h-4 animate-none",
                  GHOST_WIDTHS[(row + cell) % GHOST_WIDTHS.length],
                )}
              />
            ))}
          </div>
        ))}
      </div>
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
