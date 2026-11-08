"use client";

import type { PrivateLocation } from "@openstatus/db/src/schema";
import { Globe } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useMemo } from "react";

import {
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  RangePlotLegend,
  RangePlotLegendItem,
} from "@/components/content/range-plot";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { getRegionAxisMax } from "@/data/metrics.client";
import type { RegionMetric } from "@/data/region-metrics";

import { getColumns } from "./columns";

export function RegionsLegend({
  degradedAfter,
  className,
  ...props
}: React.ComponentProps<typeof RangePlotLegend> & {
  degradedAfter?: number | null;
}) {
  return (
    <RangePlotLegend className={className} {...props}>
      <RangePlotLegendItem variant="dot">P50</RangePlotLegendItem>
      <RangePlotLegendItem variant="box">P75 – P95</RangePlotLegendItem>
      <RangePlotLegendItem variant="tick">P90</RangePlotLegendItem>
      <RangePlotLegendItem variant="end">P99</RangePlotLegendItem>
      {degradedAfter != null ? (
        <RangePlotLegendItem variant="warning">
          Degraded
          <span className="text-muted-foreground font-mono tabular-nums">
            &gt;{degradedAfter}ms
          </span>
        </RangePlotLegendItem>
      ) : null}
    </RangePlotLegend>
  );
}

export function RegionsDataTable({
  data,
  privateLocations,
  loading,
  degradedAfter,
  filteredOut,
  onShowAll,
}: {
  data: RegionMetric[];
  privateLocations: PrivateLocation[];
  loading: boolean;
  /** Values above it render in the warning color. */
  degradedAfter: number | null;
  /** The region filter left none of the configured regions. */
  filteredOut?: boolean;
  onShowAll?: () => void;
}) {
  const max = useMemo(() => getRegionAxisMax(data), [data]);
  // only when no region reported at all; a single dead region keeps its row
  const reported = useMemo(
    () => (!loading && data.every((row) => row.buckets === 0) ? [] : data),
    [data, loading],
  );
  const columns = useMemo(
    () =>
      getColumns({
        privateLocations,
        max,
        loading,
        degradedAfter,
        empty: reported.length === 0,
      }),
    [privateLocations, max, loading, degradedAfter, reported.length],
  );

  return (
    // A hovered or keyboard-focused row lifts: the others fade.
    <div
      className={cn(
        // the plot hover area bleeds past the last row; clip it instead of scrolling
        "[&_[data-slot=table-container]]:overflow-y-hidden",
        "[&_tbody_tr]:transition-[opacity,background-color] [&_tbody_tr]:duration-150 [&_tbody_tr]:ease-out",
        "[&_tbody:has(tr:hover,:focus-visible)_tr:not(:hover,:has(:focus-visible))]:opacity-50",
      )}
    >
      <DataTable
        paginationComponent={DataTablePaginationSimple}
        defaultPagination={{ pageIndex: 0, pageSize: 50 }}
        data={reported}
        columns={columns}
        defaultSorting={[{ id: "p50", desc: false }]}
        emptyState={
          <DataTableEmpty>
            <EmptyStateMedia>
              <Globe />
            </EmptyStateMedia>
            {filteredOut ? (
              <>
                <EmptyStateTitle>
                  No regions match the selected filter
                </EmptyStateTitle>
                <EmptyStateDescription>
                  Pick a region configured on this monitor to compare latency
                  per region.
                </EmptyStateDescription>
                {onShowAll ? (
                  <EmptyStateActions>
                    <Button size="sm" variant="outline" onClick={onShowAll}>
                      Show all regions
                    </Button>
                  </EmptyStateActions>
                ) : null}
              </>
            ) : data.length === 0 ? (
              <>
                <EmptyStateTitle>No regions configured</EmptyStateTitle>
                <EmptyStateDescription>
                  Add a region or private location to the monitor to compare
                  latency per region.
                </EmptyStateDescription>
              </>
            ) : (
              <>
                <EmptyStateTitle>No checks in this period</EmptyStateTitle>
                <EmptyStateDescription>
                  None of the {data.length}{" "}
                  {data.length === 1 ? "region" : "regions"} reported. Pick a
                  longer period or wait for the next check.
                </EmptyStateDescription>
              </>
            )}
          </DataTableEmpty>
        }
      />
    </div>
  );
}
