"use client";

import type { PrivateLocation } from "@openstatus/db/src/schema";
import { cn } from "@openstatus/ui/lib/utils";
import { useMemo } from "react";

import {
  RangePlotLegend,
  RangePlotLegendItem,
} from "@/components/content/range-plot";
import { DataTable } from "@/components/ui/data-table/data-table";
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
}: {
  data: RegionMetric[];
  privateLocations: PrivateLocation[];
  loading: boolean;
  /** Values above it render in the warning color. */
  degradedAfter: number | null;
}) {
  const max = useMemo(() => getRegionAxisMax(data), [data]);
  const columns = useMemo(
    () => getColumns({ privateLocations, max, loading, degradedAfter }),
    [privateLocations, max, loading, degradedAfter],
  );

  return (
    // A hovered or keyboard-focused row lifts: the others fade.
    <div
      className={cn(
        // flush with the section text instead of inset by the cell padding
        "[&_tr>*:first-child]:pl-0 [&_tr>*:last-child]:pr-0",
        // the plot hover area bleeds past the last row; clip it instead of scrolling
        "[&_[data-slot=table-container]]:overflow-y-hidden",
        "[&_tbody_tr]:transition-[opacity,background-color] [&_tbody_tr]:duration-150 [&_tbody_tr]:ease-out",
        "[&_tbody:has(tr:hover,:focus-visible)_tr:not(:hover,:has(:focus-visible))]:opacity-50",
      )}
    >
      <DataTable
        data={data}
        columns={columns}
        pagination={{ pageIndex: 0, pageSize: Math.max(data.length, 1) }}
        defaultSorting={[{ id: "p50", desc: false }]}
      />
    </div>
  );
}
