"use client";

import type { PrivateLocation } from "@openstatus/db/src/schema";
import { ChevronRight } from "@openstatus/icons";
import { formatRegionCode, getRegionInfo } from "@openstatus/regions";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { IconCloudProvider } from "@/components/common/icon-cloud-provider";
import {
  RangePlot,
  RangePlotAxis,
  RangePlotEmpty,
  RangePlotGrid,
  RangePlotMarker,
  RangePlotOverflow,
  RangePlotPositionIcon,
  RangePlotRange,
  RangePlotThreshold,
} from "@/components/content/range-plot";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RegionMetric } from "@/data/region-metrics";

const PERCENTILES = [
  { key: "p50", at: "min" },
  { key: "p75", at: "start" },
  { key: "p90", at: "mid" },
  { key: "p95", at: "end" },
  { key: "p99", at: "max" },
] as const;

type RegionInfo = ReturnType<typeof getRegionInfo>;

/** Provider icon, code and location; shared by the row and its tooltip so they read the same. */
function RegionLabel({
  region,
  city,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  region: RegionInfo;
  /** City only, to fit the table column. */
  city?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      {/* codes repeat across providers (fly fra, koyeb fra) */}
      <IconCloudProvider
        provider={region.provider}
        className="text-muted-foreground size-3 shrink-0"
      />
      <span className="max-w-[90px] shrink-0 truncate font-mono">
        {formatRegionCode(region.code)}
      </span>
      <span
        className={cn(
          "text-muted-foreground ml-1 truncate font-sans",
          city && "hidden sm:inline",
        )}
      >
        {city ? region.location.split(",")[0] : region.location}
      </span>
    </div>
  );
}

function SpreadCell({
  metric,
  region,
  max,
  loading,
  degradedAfter,
}: {
  metric: RegionMetric;
  region: RegionInfo;
  max: number;
  loading: boolean;
  degradedAfter: number | null;
}) {
  const [open, setOpen] = useState(false);
  const { p50, p75, p90, p95, p99, buckets } = metric;
  const clipped = p99 > max;

  if (loading || buckets === 0) {
    return (
      <RangePlot max={max}>
        <RangePlotGrid />
        {degradedAfter != null && degradedAfter <= max ? (
          <RangePlotThreshold value={degradedAfter} />
        ) : null}
        {loading ? (
          <Skeleton className="absolute top-1/2 h-1 w-1/3 -translate-y-1/2" />
        ) : (
          <RangePlotEmpty>
            No checks from this region in the selected period
          </RangePlotEmpty>
        )}
      </RangePlot>
    );
  }

  return (
    // The whole cell opens the card; it anchors to the P90 tick so it sits above the markers.
    <HoverCard open={open}>
      {/* hit area bleeds over the cell padding and row border, so moving between rows never leaves a hover gap */}
      <div
        className="-mt-2 -mb-[9px] pt-2 pb-[9px]"
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
      >
        <RangePlot
          max={max}
          tabIndex={0}
          aria-label={`${formatRegionCode(region.code)}: ${PERCENTILES.map(
            ({ key }) => `${key.toUpperCase()} ${metric[key]} ms`,
          ).join(", ")}`}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-[3px]"
        >
          <RangePlotGrid />
          {degradedAfter != null && degradedAfter <= max ? (
            <RangePlotThreshold value={degradedAfter} />
          ) : null}
          <RangePlotRange variant="whisker" from={p50} to={p99} />
          <RangePlotRange variant="box" from={p75} to={p95} />
          {clipped ? null : <RangePlotMarker value={p99} variant="end" />}
          <HoverCardTrigger asChild>
            <RangePlotMarker value={p90} variant="tick" />
          </HoverCardTrigger>
          <RangePlotMarker value={p50} variant="dot" />
          {clipped ? (
            <RangePlotOverflow>
              {/* narrow plots keep only the chevron so the P90 tick stays visible */}
              <span className="@max-xs:hidden">P99 {p99}</span>
              <ChevronRight aria-hidden className="-mr-0.5 size-3" />
            </RangePlotOverflow>
          ) : null}
        </RangePlot>
      </div>
      {/* same card as the uptime cell; duration-0 so moving down the rows swaps cards instead of re-animating */}
      <HoverCardContent
        side="top"
        className="border-border/50 grid w-auto min-w-40 gap-1.5 rounded-lg p-0 px-2.5 py-1.5 text-xs shadow-xl duration-0"
      >
        <RegionLabel region={region} />
        <ul className="grid gap-1.5">
          {PERCENTILES.map(({ key, at }) => {
            const variant =
              degradedAfter != null && metric[key] > degradedAfter
                ? "warning"
                : "default";
            return (
              <li key={key} className="flex items-center gap-2">
                <RangePlotPositionIcon at={at} variant={variant} />
                <span className="text-muted-foreground font-mono">
                  {key.toUpperCase()}
                </span>
                <TableCellNumber
                  value={metric[key]}
                  unit="ms"
                  variant={variant}
                  className="ml-auto pl-4 tabular-nums"
                />
              </li>
            );
          })}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function percentileColumn(
  key: "p50" | "p90" | "p99",
  loading: boolean,
  degradedAfter: number | null,
): ColumnDef<RegionMetric> {
  return {
    id: key,
    // regions without data sort last instead of as 0 ms
    accessorFn: (row) => (row.buckets ? row[key] : undefined),
    sortUndefined: "last",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={key.toUpperCase()}
        className="justify-end"
      />
    ),
    cell: ({ row }) =>
      loading ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <TableCellNumber
          value={row.original.buckets ? row.original[key] : undefined}
          variant={
            degradedAfter != null && row.original[key] > degradedAfter
              ? "warning"
              : "default"
          }
          unit="ms"
          empty="–"
        />
      ),
    enableHiding: false,
    meta: {
      cellClassName: "w-12 text-right",
    },
  };
}

export function getColumns({
  privateLocations,
  max,
  loading,
  degradedAfter,
}: {
  privateLocations: PrivateLocation[];
  max: number;
  loading: boolean;
  degradedAfter: number | null;
}): ColumnDef<RegionMetric>[] {
  return [
    {
      accessorKey: "region",
      header: "Region",
      cell: ({ row }) => {
        const region = getRegionInfo(row.original.region, {
          location: privateLocations.find(
            (location) => String(location.id) === row.original.region,
          )?.name,
        });
        return (
          <RegionLabel
            region={region}
            city
            data-empty={!loading && row.original.buckets === 0}
            className="data-[empty=true]:text-muted-foreground max-w-56"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
      meta: {
        cellClassName: "w-24 font-mono sm:w-56",
      },
    },
    {
      id: "spread",
      header: () => (loading ? null : <RangePlotAxis max={max} unit="ms" />),
      cell: ({ row }) => (
        <SpreadCell
          metric={row.original}
          region={getRegionInfo(row.original.region, {
            location: privateLocations.find(
              (location) => String(location.id) === row.original.region,
            )?.name,
          })}
          max={max}
          loading={loading}
          degradedAfter={degradedAfter}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: "px-4",
        cellClassName: "relative w-full min-w-[200px] max-w-full px-4",
      },
    },
    percentileColumn("p50", loading, degradedAfter),
    percentileColumn("p90", loading, degradedAfter),
    percentileColumn("p99", loading, degradedAfter),
  ];
}
