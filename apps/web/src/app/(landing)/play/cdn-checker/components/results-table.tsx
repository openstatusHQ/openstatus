"use client";

import { CDN_LABELS } from "@openstatus/header-analysis";
import { AVAILABLE_REGIONS, regionDict } from "@openstatus/regions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";

import { IconCloudProvider } from "@/components/icon-cloud-provider";
import type { CdnRegionResult } from "@/lib/cdn-checker/schema";
import { regionFormatter } from "@/lib/checker/utils";
import { cn } from "@/lib/utils";

import { useCdnChecker } from "../client";
import {
  CACHE_STATUS_COLOR,
  CACHE_STATUS_DESCRIPTION,
  formatAge,
} from "../utils";

function CacheStatusIndicator({
  status,
}: {
  status: CdnRegionResult["cacheStatus"];
}) {
  return (
    <div
      className={cn("size-4", CACHE_STATUS_COLOR[status])}
      title={CACHE_STATUS_DESCRIPTION[status]}
    />
  );
}

export function CacheStatusLegend() {
  return (
    <div className="not-prose my-4 flex flex-wrap gap-2">
      {Object.entries(CACHE_STATUS_COLOR).map(([status, className]) => (
        <div
          key={status}
          className={cn("text-background text-base", className)}
          title={
            CACHE_STATUS_DESCRIPTION[status as CdnRegionResult["cacheStatus"]]
          }
        >
          {status}
        </div>
      ))}
    </div>
  );
}

function DetailsDialog({ result }: { result: CdnRegionResult }) {
  const config = regionDict[result.region];
  const entries = [
    { label: "Edge", value: result.edgePop ?? "-" },
    { label: "Status", value: String(result.statusCode) },
    { label: "Age", value: formatAge(result.age) },
    { label: "CDN", value: result.cdn ? CDN_LABELS[result.cdn] : "-" },
    { label: "Cache Header", value: result.cacheStatusRaw },
    { label: "Cache-Control", value: result.cacheControl },
    { label: "ETag", value: result.etag },
    { label: "Edge Location", value: result.edgePopLocation },
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
      <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto rounded-none! font-mono sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Cache Details</DialogTitle>
          <DialogDescription>
            Cache status and response headers for this region.
          </DialogDescription>
        </DialogHeader>
        <div className="prose dark:prose-invert max-w-none min-w-0">
          <table>
            <tbody>
              <tr>
                <td>Region</td>
                <td>
                  {config.location} {config.flag}, {config.provider}{" "}
                  <IconCloudProvider
                    provider={config.provider}
                    className="inline size-4"
                  />
                </td>
              </tr>
              {entries.map((entry) => (
                <tr key={entry.label}>
                  <td className="whitespace-nowrap">{entry.label}</td>
                  <td className="break-words">{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ResultsTable() {
  const { rows } = useCdnChecker();

  const successRows = rows
    .filter((row) => row.state === "success")
    .sort((a, b) => a.ttfbMs - b.ttfbMs);
  const errorRows = rows.filter((row) => row.state === "error");

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
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="w-12" />
              <th className="w-12" />
              <th>Region</th>
              <th className="text-right!">Latency</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {successRows.length === 0 ? (
              <tr>
                <td>
                  <IconCloudProvider
                    provider="globe"
                    className="text-muted-foreground size-4"
                  />
                </td>
                <td>
                  <div className="bg-muted-foreground size-4" />
                </td>
                <td>
                  <br />
                </td>
                <td>
                  <br />
                </td>
                <td>
                  <br />
                </td>
              </tr>
            ) : (
              successRows.map((row) => {
                const config = regionDict[row.region];
                return (
                  <tr key={row.region}>
                    <td>
                      <IconCloudProvider
                        provider={config.provider}
                        className="size-4"
                      />
                    </td>
                    <td>
                      <CacheStatusIndicator status={row.cacheStatus} />
                    </td>
                    <td className="whitespace-nowrap">
                      {config.flag} {config.code}{" "}
                      <span className="text-muted-foreground">
                        {config.location}
                      </span>
                    </td>
                    <td className="text-right! tabular-nums">
                      {Intl.NumberFormat("en-US", {
                        maximumFractionDigits: 0,
                      }).format(row.ttfbMs)}
                      ms
                    </td>
                    <td className="text-right!">
                      <DetailsDialog result={row} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <caption>
            Results of your check ({rows.length} / {AVAILABLE_REGIONS.length}{" "}
            regions)
          </caption>
        </table>
      </div>
    </div>
  );
}
