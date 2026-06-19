"use client";

import { CDN_LABELS, type CdnProvider } from "@openstatus/header-analysis";
import { regionDict } from "@openstatus/regions";
import { Button } from "@openstatus/ui/components/ui/button";
import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import {
  DataTable,
  type DataTableToolbarProps,
} from "@/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import type { CdnRegionResult } from "@/lib/cdn-checker/schema";
import { continentFormatter, regionFormatter } from "@/lib/checker/utils";
import { cn } from "@/lib/utils";

import { useCdnChecker } from "../client";
import {
  CACHE_STATUS_COLOR,
  CACHE_STATUS_DESCRIPTION,
  formatAge,
  formatBytes,
} from "../utils";

function arrayFilter(
  row: Row<CdnRegionResult>,
  id: string,
  value: unknown[],
): boolean {
  return value.includes(row.getValue(id));
}

const columns: ColumnDef<CdnRegionResult>[] = [
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      const config = regionDict[row.original.region];
      return (
        <span className="whitespace-nowrap">
          {config.flag} {config.code}{" "}
          <span className="text-muted-foreground">{config.location}</span>
        </span>
      );
    },
  },
  {
    id: "continent",
    accessorFn: (row) => continentFormatter(row.region),
    filterFn: arrayFilter,
  },
  {
    accessorKey: "cacheStatus",
    header: "Cache",
    filterFn: arrayFilter,
    cell: ({ row }) => (
      <span
        className="flex items-center gap-1.5 whitespace-nowrap"
        title={CACHE_STATUS_DESCRIPTION[row.original.cacheStatus]}
      >
        <span
          className={cn(
            "inline-block size-3",
            CACHE_STATUS_COLOR[row.original.cacheStatus],
          )}
        />
        {row.original.cacheStatus}
      </span>
    ),
  },
  {
    accessorKey: "edgePop",
    header: "Edge",
    cell: ({ row }) => (
      <span title={row.original.edgePopLocation ?? undefined}>
        {row.original.edgePop ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "ttfbMs",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TTFB" />
    ),
    cell: ({ row }) => `${row.original.ttfbMs}ms`,
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  },
  {
    accessorKey: "totalMs",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total" />
    ),
    cell: ({ row }) => `${row.original.totalMs}ms`,
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  },
  {
    accessorKey: "statusCode",
    header: "Status",
    filterFn: arrayFilter,
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  },
  {
    accessorKey: "responseSize",
    header: "Size",
    cell: ({ row }) => formatBytes(row.original.responseSize),
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  },
  {
    accessorKey: "age",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Age" />
    ),
    cell: ({ row }) => formatAge(row.original.age),
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  },
  {
    accessorKey: "cdn",
    header: "CDN",
    filterFn: arrayFilter,
    cell: ({ row }) => (row.original.cdn ? CDN_LABELS[row.original.cdn] : "-"),
  },
];

function facetOptions(
  table: Table<CdnRegionResult>,
  columnId: string,
  label: (value: string) => string = String,
) {
  const facets = table.getColumn(columnId)?.getFacetedUniqueValues();
  return [...(facets?.keys() ?? [])]
    .filter((value) => value !== null)
    .sort()
    .map((value) => ({ label: label(String(value)), value }));
}

function Toolbar({ table }: DataTableToolbarProps<CdnRegionResult>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DataTableFacetedFilter
        column={table.getColumn("cacheStatus")}
        title="Cache"
        options={facetOptions(table, "cacheStatus")}
      />
      <DataTableFacetedFilter
        column={table.getColumn("cdn")}
        title="CDN"
        options={facetOptions(
          table,
          "cdn",
          (value) => CDN_LABELS[value as CdnProvider] ?? value,
        )}
      />
      <DataTableFacetedFilter
        column={table.getColumn("statusCode")}
        title="Status"
        options={facetOptions(table, "statusCode")}
      />
      <DataTableFacetedFilter
        column={table.getColumn("continent")}
        title="Continent"
        options={facetOptions(table, "continent")}
      />
      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => table.resetColumnFilters()}
          className="h-8 px-2 lg:px-3"
        >
          Reset
          <X />
        </Button>
      )}
    </div>
  );
}

function RowDetail({ row }: { row: Row<CdnRegionResult> }) {
  const { cacheStatusRaw, cacheControl, etag, edgePopLocation } = row.original;
  const entries = [
    { label: "cache header", value: cacheStatusRaw },
    { label: "cache-control", value: cacheControl },
    { label: "etag", value: etag },
    { label: "edge location", value: edgePopLocation },
  ].filter((entry) => entry.value);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground my-0! p-2 text-sm">
        No cache headers returned.
      </p>
    );
  }

  return (
    <dl className="my-0! grid gap-1 p-2 font-mono text-sm">
      {entries.map((entry) => (
        <div key={entry.label} className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">{entry.label}:</dt>
          <dd className="my-0! ml-0! break-all">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResultsTable() {
  const { rows } = useCdnChecker();

  const successRows = rows.filter((row) => row.state === "success");
  const errorRows = rows.filter((row) => row.state === "error");

  if (rows.length === 0) return null;

  return (
    <div className="not-prose grid gap-2">
      {errorRows.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          Unreachable:{" "}
          {errorRows
            .map((row) => regionFormatter(row.region, "short"))
            .join(", ")}
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={successRows}
        toolbarComponent={Toolbar}
        rowComponent={RowDetail}
        onRowClick={(row) => row.toggleExpanded()}
        defaultSorting={[{ id: "ttfbMs", desc: false }]}
        defaultColumnVisibility={{ continent: false }}
      />
    </div>
  );
}
