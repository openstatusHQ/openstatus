"use client";

import { CDN_LABELS } from "@openstatus/header-analysis";
import { regionDict } from "@openstatus/regions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { CdnRegionResult } from "@/lib/cdn-checker/schema";
import { regionFormatter } from "@/lib/checker/utils";
import { cn } from "@/lib/utils";

import { useCdnChecker } from "../client";
import {
  CACHE_STATUS_COLOR,
  CACHE_STATUS_DESCRIPTION,
  formatAge,
} from "../utils";

function CacheStatusPill({
  status,
}: {
  status: CdnRegionResult["cacheStatus"];
}) {
  return (
    <span
      className={cn("text-background text-base", CACHE_STATUS_COLOR[status])}
      title={CACHE_STATUS_DESCRIPTION[status]}
    >
      {status}
    </span>
  );
}

function DetailsDialog({ result }: { result: CdnRegionResult }) {
  const config = regionDict[result.region];
  const entries = [
    { label: "edge", value: result.edgePop ?? "-" },
    { label: "status", value: String(result.statusCode) },
    { label: "age", value: formatAge(result.age) },
    { label: "cdn", value: result.cdn ? CDN_LABELS[result.cdn] : "-" },
    { label: "cache header", value: result.cacheStatusRaw },
    { label: "cache-control", value: result.cacheControl },
    { label: "etag", value: result.etag },
    { label: "edge location", value: result.edgePopLocation },
  ].filter((entry) => entry.value);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
        >
          Details
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {config.flag} {config.code}{" "}
            <span className="text-muted-foreground font-normal">
              {config.location}
            </span>
          </DialogTitle>
          <DialogDescription>
            Cache status and response headers for this region.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.label}
                className="border-border border-b last:border-0"
              >
                <td className="text-muted-foreground py-1.5 pr-4 align-top whitespace-nowrap">
                  {entry.label}
                </td>
                <td className="py-1.5 font-mono break-all">{entry.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
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
    accessorKey: "cacheStatus",
    header: "Cache",
    cell: ({ row }) => <CacheStatusPill status={row.original.cacheStatus} />,
  },
  {
    accessorKey: "ttfbMs",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
    ),
    cell: ({ row }) => `${row.original.ttfbMs}ms`,
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
  },
  {
    id: "details",
    header: () => <span className="sr-only">Details</span>,
    cell: ({ row }) => <DetailsDialog result={row.original} />,
    meta: {
      cellClassName: "text-right",
    },
  },
];

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
        defaultSorting={[{ id: "ttfbMs", desc: false }]}
      />
    </div>
  );
}
