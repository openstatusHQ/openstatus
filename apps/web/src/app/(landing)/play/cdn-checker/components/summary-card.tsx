"use client";

import { CDN_LABELS } from "@openstatus/header-analysis";
import { AVAILABLE_REGIONS } from "@openstatus/regions";

import { regionFormatter } from "@/lib/checker/utils";
import { cn } from "@/lib/utils";

import { useCdnChecker } from "../client";

const UNCACHED_PREVIEW_COUNT = 6;

function ratioColor(cached: number, responded: number) {
  if (responded === 0) return "text-muted-foreground";
  const ratio = cached / responded;
  if (ratio >= 0.9) return "text-success";
  if (ratio >= 0.5) return "text-warning";
  return "text-destructive";
}

export function SummaryCard() {
  const { summary, isPending, rows } = useCdnChecker();

  if (!summary) {
    if (isPending || rows.length > 0) {
      return (
        <div className="border-border text-muted-foreground border p-4">
          Probing{" "}
          {rows.length > 0
            ? `${rows.length} of ${AVAILABLE_REGIONS.length} regions...`
            : "..."}
        </div>
      );
    }
    return null;
  }

  const {
    cachedRegions,
    respondedRegions,
    uncachedRegions,
    unreachableRegions,
    cdn,
    mixedCdn,
    topology,
    topologyBasis,
  } = summary;

  return (
    <div className="border-border grid gap-4 border p-4 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <p className="text-muted-foreground my-0! text-sm">Cache hit ratio</p>
        <p
          className={cn(
            "my-0! text-3xl font-semibold tabular-nums",
            ratioColor(cachedRegions, respondedRegions),
          )}
        >
          {cachedRegions} / {respondedRegions}
        </p>
        <p className="text-muted-foreground my-0! text-sm">
          regions served from cache
          {unreachableRegions.length > 0
            ? ` (${unreachableRegions.length} unreachable)`
            : null}
        </p>
      </div>
      <div className="sm:col-span-1">
        <p className="text-muted-foreground my-0! text-sm">CDN</p>
        <p className="my-0! text-3xl font-semibold">
          {cdn ? CDN_LABELS[cdn] : "Not detected"}
        </p>
        <p className="text-muted-foreground my-0! text-sm">
          {mixedCdn
            ? "multiple providers detected"
            : topology !== "unknown"
              ? `${topology}${topologyBasis === "provider" ? " (inferred)" : ""}`
              : "topology unknown"}
        </p>
      </div>
      <div className="sm:col-span-1">
        <p className="text-muted-foreground my-0! text-sm">Uncached regions</p>
        {uncachedRegions.length === 0 ? (
          <p className="text-success my-0! text-3xl font-semibold">None</p>
        ) : (
          <>
            <p className="my-0! text-3xl font-semibold tabular-nums">
              {uncachedRegions.length}
            </p>
            <p className="text-muted-foreground my-0! text-sm leading-6">
              {uncachedRegions
                .slice(0, UNCACHED_PREVIEW_COUNT)
                .map((region) => regionFormatter(region, "short"))
                .join(", ")}
              {uncachedRegions.length > UNCACHED_PREVIEW_COUNT
                ? ` +${uncachedRegions.length - UNCACHED_PREVIEW_COUNT} more`
                : ""}
            </p>
          </>
        )}
        <p className="text-muted-foreground my-0! text-sm">
          {uncachedRegions.length > 0
            ? "MISS can mean first request — run again to confirm"
            : "caching looks healthy"}
        </p>
      </div>
    </div>
  );
}
