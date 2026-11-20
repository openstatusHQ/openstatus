import { ChevronDown, ChevronUp } from "@openstatus/icons";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import type React from "react";

export type MetricStatus = "success" | "warning" | "destructive" | "info";

type MetricStripItemProps = {
  status?: MetricStatus;
  /** Alarm-type counts only: `true` tints the item, `false` mutes its value. */
  active?: boolean;
};

/**
 * Summary metrics in one bordered box: columns when the strip is wide,
 * label/value lines when it is narrow. A container query on the strip itself.
 */
export function MetricStrip({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="metric-strip"
      className={cn(
        "bg-border text-card-foreground @container grid gap-px overflow-hidden rounded-lg border",
        className,
      )}
      {...props}
    />
  );
}

export function MetricStripRow({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Within one strip, either every row has a label or none does. */
  label?: string;
}) {
  return (
    <div
      data-slot="metric-strip-row"
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn(
        "grid gap-px @3xl:auto-cols-[minmax(0,1fr)] @3xl:grid-flow-col",
        label && "@3xl:grid-cols-[6.5rem]",
        className,
      )}
      {...props}
    >
      {label ? (
        <span
          data-slot="metric-strip-row-label"
          aria-hidden
          className="text-muted-foreground bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-card))] px-3 py-1.5 text-xs @3xl:py-2"
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

// a status tint outranks the plain fill, so hover and pressed deepen it instead of greying it
const itemClassName = cn(
  "group/metric-strip-item flex min-w-0 items-center justify-between gap-3 bg-(--metric-strip-tint,var(--metric-strip-fill,var(--color-card))) px-3 py-2.5",
  "[--metric-strip-mix:10%]",
  "@3xl:flex-col @3xl:items-start @3xl:justify-start @3xl:gap-1 @3xl:py-2",
  "data-[active=true]:data-[status=success]:[--metric-strip-tint:color-mix(in_oklab,var(--color-success)_var(--metric-strip-mix),var(--color-card))]",
  "data-[active=true]:data-[status=warning]:[--metric-strip-tint:color-mix(in_oklab,var(--color-warning)_var(--metric-strip-mix),var(--color-card))]",
  "data-[active=true]:data-[status=destructive]:[--metric-strip-tint:color-mix(in_oklab,var(--color-destructive)_var(--metric-strip-mix),var(--color-card))]",
  "data-[active=true]:data-[status=info]:[--metric-strip-tint:color-mix(in_oklab,var(--color-info)_var(--metric-strip-mix),var(--color-card))]",
);

export function MetricStripItem({
  status,
  active,
  className,
  ...props
}: React.ComponentProps<"div"> & MetricStripItemProps) {
  return (
    <div
      data-slot="metric-strip-item"
      data-status={status}
      data-active={active}
      className={cn(itemClassName, className)}
      {...props}
    />
  );
}

/** An item that filters or sorts; pass `aria-pressed` for its state. */
export function MetricStripButton({
  status,
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & MetricStripItemProps) {
  return (
    <button
      type="button"
      data-slot="metric-strip-item"
      data-status={status}
      data-active={active}
      className={cn(
        itemClassName,
        "cursor-pointer text-left transition-colors outline-none",
        "hover:[--metric-strip-fill:var(--color-muted)] aria-pressed:[--metric-strip-fill:var(--color-muted)]",
        "hover:[--metric-strip-mix:15%] aria-pressed:[--metric-strip-mix:20%]",
        // inset: the strip clips anything drawn outside the item
        "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset",
        className,
      )}
      {...props}
    />
  );
}

export function MetricStripLabel({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="metric-strip-label"
      className={cn(
        "text-muted-foreground max-w-full min-w-0 truncate text-sm",
        "before:mr-1.5 before:hidden before:size-2 before:rounded-full before:align-[0.05em] before:content-['']",
        "group-data-[status]/metric-strip-item:before:inline-block",
        "group-data-[status=success]/metric-strip-item:before:bg-success",
        "group-data-[status=warning]/metric-strip-item:before:bg-warning",
        "group-data-[status=destructive]/metric-strip-item:before:bg-destructive",
        "group-data-[status=info]/metric-strip-item:before:bg-info",
        "[&_svg]:ml-1.5 [&_svg]:inline-block [&_svg]:size-3.5 [&_svg]:align-[-0.125em]",
        // in a button the icon is its state: shown on hover, focus and when pressed
        "in-[button:not(:hover,:focus-visible,[aria-pressed=true])]:[&_svg]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function MetricStripValue({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="metric-strip-value"
      className={cn(
        "font-commit-mono shrink-0 text-right text-base font-medium tracking-tight whitespace-nowrap tabular-nums",
        "@3xl:max-w-full @3xl:shrink @3xl:text-left @3xl:whitespace-normal",
        "group-data-[active=false]/metric-strip-item:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MetricStripUnit({
  className,
  ...props
}: React.ComponentProps<"small">) {
  return (
    <small
      data-slot="metric-strip-unit"
      className={cn(
        "text-muted-foreground ml-0.5 text-xs font-normal",
        className,
      )}
      {...props}
    />
  );
}

export function MetricStripAside({
  className,
  ...props
}: React.ComponentProps<"small">) {
  return (
    <small
      data-slot="metric-strip-aside"
      className={cn(
        "text-muted-foreground ml-1.5 text-xs font-normal",
        className,
      )}
      {...props}
    />
  );
}

/** Trend against the previous period; `value` is the ratio. Nothing at 0%. */
export function MetricStripTrend({
  value,
  decimal = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  value: number;
  decimal?: number;
}) {
  const round = 10 ** decimal;
  const percentage = Math.round((value - 1) * 100 * round) / round;

  if (percentage === 0) return null;

  const Icon = percentage > 0 ? ChevronUp : ChevronDown;

  return (
    <span
      data-slot="metric-strip-trend"
      className={cn(
        "ml-1.5 text-xs font-normal whitespace-nowrap",
        percentage > 0 ? "text-destructive" : "text-success",
        className,
      )}
      {...props}
    >
      <Icon
        aria-hidden
        className="mr-px inline-block size-3 align-[-0.125em]"
      />
      {Math.abs(percentage)}%
    </span>
  );
}

/** Takes the value's place; as tall as its line, so loading keeps the height. */
export function MetricStripSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      data-slot="metric-strip-skeleton"
      className={cn("h-6 w-12 shrink-0", className)}
      {...props}
    />
  );
}
