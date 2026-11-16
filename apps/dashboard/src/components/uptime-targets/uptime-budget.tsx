"use client";

import { cn } from "@openstatus/ui/lib/utils";

import { budgetShare, formatUptimeDuration } from "@/data/reports.client";

/** The month's down-time budget: burned so far, and where the burn is on pace to end the month. */
export function UptimeBudgetBar({
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
  const text = `${formatUptimeDuration(burnedMs)} of ${formatUptimeDuration(budgetMs)} burned${
    paceMs == null ? "" : `, on pace for ${formatUptimeDuration(paceMs)}`
  }`;
  return (
    <div
      data-slot="uptime-budget-bar"
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
