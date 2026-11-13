"use client";

import { formatSlaUptime } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";

import {
  budgetShare,
  formatBudgetLeft,
  formatPendingTerms,
  formatSlaDuration,
  formatSlaTarget,
} from "@/data/reportings.client";
import { useTRPC } from "@/lib/trpc/client";

/** The month's down-time budget: burned so far, and where the burn is on pace to end the month. */
export function SlaBudgetBar({
  burnedMs,
  budgetMs,
  paceMs,
  size = "default",
  className,
}: {
  burnedMs: number;
  budgetMs: number;
  paceMs?: number | null;
  size?: "sm" | "default";
  className?: string;
}) {
  const share = budgetShare(burnedMs, budgetMs);
  const over = burnedMs > budgetMs;
  const pace = paceMs == null ? null : budgetShare(paceMs, budgetMs);
  const text = `${formatSlaDuration(burnedMs)} of ${formatSlaDuration(budgetMs)} burned${
    paceMs == null ? "" : `, on pace for ${formatSlaDuration(paceMs)}`
  }`;
  return (
    <div
      data-slot="sla-budget-bar"
      role="meter"
      aria-label="Down-time budget"
      aria-valuemin={0}
      aria-valuemax={budgetMs}
      aria-valuenow={Math.min(burnedMs, budgetMs)}
      aria-valuetext={text}
      className={cn(
        "bg-muted relative w-full overflow-hidden rounded-full",
        size === "sm" ? "h-1" : "h-2",
        className,
      )}
    >
      <div
        // fills once on mount; @starting-style, so no effect is needed
        className={cn(
          "h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none starting:scale-x-0",
          over ? "bg-destructive" : "bg-info",
        )}
        style={{ transform: `scaleX(${share})` }}
      />
      {pace !== null && pace > 0 ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 w-0.5 -translate-x-1/2",
            paceMs != null && paceMs > budgetMs
              ? "bg-destructive"
              : "bg-foreground/60",
          )}
          style={{ left: `${pace * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/** One reporting in the monitor sidebar: uptime so far, budget bar, time left. */
export function SlaMonitorSidebarEntry({
  policy,
  monitorId,
}: {
  policy: {
    id: number;
    name: string;
    liveTerms: { target: number };
    pendingTerms: { target: number; effectiveFrom: string } | null;
  };
  monitorId: number;
}) {
  const trpc = useTRPC();
  const { data, isError } = useQuery(
    trpc.monitorReporting.monitorMonth.queryOptions({
      id: policy.id,
      monitorId,
    }),
  );
  const budget = data?.budget ?? null;

  return (
    <NextLink
      href={`/reportings/monitors/${policy.id}?monitor=${monitorId}`}
      className="hover:bg-sidebar-accent focus-visible:ring-ring flex flex-col gap-1.5 border-b px-2 py-2 text-sm transition-colors duration-150 ease-[ease] outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset"
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate">{policy.name}</span>
        <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
          {formatSlaTarget(policy.liveTerms.target)}%
          {policy.pendingTerms ? (
            <span> {formatPendingTerms(policy.pendingTerms)}</span>
          ) : null}
        </span>
      </span>
      {data || isError ? (
        <>
          {budget ? (
            <SlaBudgetBar
              size="sm"
              burnedMs={budget.burnedMs}
              budgetMs={budget.budgetMs}
            />
          ) : (
            <span aria-hidden="true" className="bg-muted h-1 rounded-full" />
          )}
          <span className="flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
            <span
              className={cn(
                data?.uptime == null
                  ? "text-muted-foreground"
                  : data.met === false
                    ? "text-destructive"
                    : "text-info",
              )}
            >
              {data?.uptime == null ? "—" : `${formatSlaUptime(data.uptime)}%`}
              <span className="text-muted-foreground"> so far</span>
            </span>
            <span
              className={cn(
                budget && budget.leftMs < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {budget ? formatBudgetLeft(budget.leftMs) : "—"}
            </span>
          </span>
        </>
      ) : (
        <>
          <Skeleton className="h-1 w-full" />
          <Skeleton className="h-4 w-full" />
        </>
      )}
    </NextLink>
  );
}
