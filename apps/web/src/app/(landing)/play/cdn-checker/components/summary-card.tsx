"use client";

import { regionFormatter } from "@/lib/checker/utils";
import { cn } from "@/lib/utils";
import { CDN_LABELS } from "@openstatus/header-analysis";
import { AVAILABLE_REGIONS } from "@openstatus/regions";
import { useCdnChecker } from "../client";

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
        <div className="border border-border p-4 text-muted-foreground">
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
    <div className="grid gap-4 border border-border p-4 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <p className="my-0! text-muted-foreground text-sm">Cache hit ratio</p>
        <p
          className={cn(
            "my-0! font-semibold text-3xl tabular-nums",
            ratioColor(cachedRegions, respondedRegions),
          )}
        >
          {cachedRegions} / {respondedRegions}
        </p>
        <p className="my-0! text-muted-foreground text-sm">
          regions served from cache
          {unreachableRegions.length > 0
            ? ` (${unreachableRegions.length} unreachable)`
            : null}
        </p>
      </div>
      <div className="sm:col-span-1">
        <p className="my-0! text-muted-foreground text-sm">CDN</p>
        <p className="my-0! font-semibold text-3xl">
          {cdn ? CDN_LABELS[cdn] : "Not detected"}
        </p>
        <p className="my-0! text-muted-foreground text-sm">
          {mixedCdn
            ? "multiple providers detected"
            : topology !== "unknown"
              ? `${topology}${topologyBasis === "provider" ? " (inferred)" : ""}`
              : "topology unknown"}
        </p>
      </div>
      <div className="sm:col-span-1">
        <p className="my-0! text-muted-foreground text-sm">Uncached regions</p>
        {uncachedRegions.length === 0 ? (
          <p className="my-0! font-semibold text-3xl text-success">None</p>
        ) : (
          <p className="my-0! font-medium text-base leading-7">
            {uncachedRegions
              .map((region) => regionFormatter(region, "short"))
              .join(", ")}
          </p>
        )}
        <p className="my-0! text-muted-foreground text-sm">
          {uncachedRegions.length > 0
            ? "MISS can mean first request — run again to confirm"
            : "caching looks healthy"}
        </p>
      </div>
    </div>
  );
}
