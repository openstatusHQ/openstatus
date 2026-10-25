"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import type { VariantProps } from "class-variance-authority";
import { format } from "date-fns";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

import { activityColorVariants } from "./activity";

/**
 * One row per event kind on a shared time axis. Positions are percentages
 * of the axis (`at`), so lanes and axis share nothing but the range.
 */
export function ActivityLanes({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-lanes"
      className={cn(
        "@container grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2",
        className,
      )}
      {...props}
    />
  );
}

function at(value: number) {
  return { "--at": value } as React.CSSProperties;
}

const AT = "left-[calc(var(--at)*1%)]";

/** Month names across the top, over the track column; a row of its own. */
export function ActivityLanesAxis({
  months,
  className,
  ...props
}: React.ComponentProps<"div"> & { months: { date: Date; at: number }[] }) {
  const hydrated = useHydrated();
  return (
    <div data-slot="activity-lanes-axis" className="contents">
      <div />
      <div
        className={cn(
          "text-muted-foreground relative h-4 font-mono text-xs leading-none",
          className,
        )}
        {...props}
      >
        {hydrated
          ? months.map((month, i) => (
              <span
                key={month.date.getTime()}
                // every other label in a narrow box, or they run into each other
                className={cn(
                  "absolute top-0",
                  i % 2 ? "hidden @3xl:inline" : "",
                  AT,
                )}
                style={at(month.at)}
              >
                {format(month.date, "MMM")}
              </span>
            ))
          : null}
      </div>
      <div />
    </div>
  );
}

export function ActivityLane({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-lane"
      className={cn("contents", className)}
      {...props}
    />
  );
}

export function ActivityLaneLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-lane-label"
      className={cn(
        "text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function ActivityLaneTrack({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-lane-track"
      className={cn("bg-muted/60 relative h-5 w-full rounded-xs", className)}
      {...props}
    />
  );
}

/** Hairline at a position: a month boundary, or `today` in the foreground. */
export function ActivityLaneMark({
  at: value,
  today,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { at: number; today?: boolean }) {
  return (
    <div
      data-slot="activity-lane-mark"
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 w-px",
        today ? "bg-foreground" : "bg-border",
        AT,
        className,
      )}
      style={{ ...at(value), ...style }}
      {...props}
    />
  );
}

/** One event on the lane; with a `label` it explains itself on hover. */
export function ActivityLaneTick({
  at: value,
  variant,
  level,
  label,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof activityColorVariants> & {
    at: number;
    label?: React.ReactNode;
  }) {
  const tick = (
    <div
      data-slot="activity-lane-tick"
      className={cn(
        "absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full",
        activityColorVariants({ variant, level: level ?? 3 }),
        label &&
          "focus-visible:ring-ring/50 cursor-default outline-none focus-visible:ring-[3px]",
        AT,
        className,
      )}
      style={{ ...at(value), ...style }}
      tabIndex={label ? 0 : undefined}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
  if (!label) return tick;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{tick}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ActivityLaneCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-lane-count"
      className={cn(
        "text-muted-foreground min-w-6 text-right font-mono text-xs tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
