"use client";

import type { CdnProvider } from "@openstatus/header-analysis";
import { Button } from "@openstatus/ui/components/ui/button";

import { APP_URL } from "@/lib/metadata/shared-metadata";

import { useCdnChecker } from "../client";

// keys in Go-canonical casing: the checker matches header assertions by
// exact key (apps/checker/pkg/assertions), not case-insensitively
const CACHE_ASSERTION: Partial<
  Record<
    CdnProvider,
    { key: string; compare: "eq" | "contains"; target: string }
  >
> = {
  cloudflare: { key: "Cf-Cache-Status", compare: "eq", target: "HIT" },
  vercel: { key: "X-Vercel-Cache", compare: "eq", target: "HIT" },
  cloudfront: { key: "X-Cache", compare: "contains", target: "Hit" },
  fastly: { key: "X-Cache", compare: "contains", target: "HIT" },
  akamai: { key: "X-Cache", compare: "contains", target: "HIT" },
};

export function MonitorCta() {
  const { summary, checkedUrl } = useCdnChecker();

  if (!summary || !checkedUrl) return null;

  const uncached = summary.uncachedRegions.length;
  const unreachable = summary.unreachableRegions.length;
  const assertion = summary.cdn ? CACHE_ASSERTION[summary.cdn] : undefined;

  const params = new URLSearchParams({ url: checkedUrl, ref: "cdn-checker" });
  if (assertion) {
    params.set("assertionHeaderKey", assertion.key);
    params.set("assertionHeaderCompare", assertion.compare);
    params.set("assertionHeaderValue", assertion.target);
  }

  return (
    <div className="border-border bg-muted/30 grid gap-4 border p-4 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <p className="my-0! font-semibold">
          {uncached > 0
            ? `Your CDN is not serving from cache in ${uncached} ${
                uncached === 1 ? "region" : "regions"
              }.`
            : unreachable > 0
              ? `Caching looks healthy in the regions that responded (${unreachable} unreachable).`
              : "Caching looks healthy — keep it that way."}
        </p>
        <p className="text-muted-foreground my-0! text-sm">
          {uncached > 0
            ? "Monitor cache status and edge latency continuously and get alerted when caching breaks. Free."
            : "Monitor this URL and get alerted the moment a region stops caching. Free."}
          {assertion
            ? ` The monitor comes pre-filled with a ${assertion.key} assertion.`
            : null}
        </p>
      </div>
      <div className="flex items-center sm:col-span-1 sm:justify-end">
        <Button asChild className="h-auto! rounded-none p-4 text-base">
          <a
            href={`${APP_URL}/monitors/create?${params.toString()}`}
            target="_blank"
            rel="noreferrer"
            className="text-background! no-underline!"
          >
            Monitor this URL
          </a>
        </Button>
      </div>
    </div>
  );
}
