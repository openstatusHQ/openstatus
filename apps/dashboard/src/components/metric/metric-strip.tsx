import { ChevronDown, ChevronUp } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
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
        "border-input bg-border text-card-foreground @container grid gap-px overflow-hidden rounded-lg border",
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
        "grid gap-px @xl:auto-cols-[minmax(0,1fr)] @xl:grid-flow-col",
        label && "@xl:grid-cols-[6.5rem]",
        className,
      )}
      {...props}
    >
      {label ? (
        <span
          data-slot="metric-strip-row-label"
          aria-hidden
          className="text-muted-foreground bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-card))] px-3 py-1.5 text-xs @xl:py-2"
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

// the fill is a variable so hover and pressed can replace it whatever the status
const itemClassName = cn(
  "group/metric-strip-item flex min-w-0 items-center justify-between gap-3 bg-(--metric-strip-fill,var(--color-card)) px-3 py-2.5",
  "@xl:flex-col @xl:items-start @xl:justify-start @xl:gap-1 @xl:py-2",
  "data-[active=true]:data-[status=success]:[--metric-strip-fill:color-mix(in_oklab,var(--color-success)_12%,var(--color-card))]",
  "data-[active=true]:data-[status=warning]:[--metric-strip-fill:color-mix(in_oklab,var(--color-warning)_12%,var(--color-card))]",
  "data-[active=true]:data-[status=destructive]:[--metric-strip-fill:color-mix(in_oklab,var(--color-destructive)_12%,var(--color-card))]",
  "data-[active=true]:data-[status=info]:[--metric-strip-fill:color-mix(in_oklab,var(--color-info)_12%,var(--color-card))]",
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
        "hover:bg-muted aria-pressed:bg-muted cursor-pointer text-left transition-colors outline-none",
        "aria-pressed:shadow-[inset_0_-2px_0_0_var(--color-foreground)]",
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
        "text-muted-foreground max-w-full min-w-0 truncate text-sm font-medium",
        "before:mr-1.5 before:hidden before:size-2 before:rounded-full before:align-[0.05em] before:content-['']",
        "group-data-[status]/metric-strip-item:before:inline-block",
        "group-data-[status=success]/metric-strip-item:before:bg-success",
        "group-data-[status=warning]/metric-strip-item:before:bg-warning",
        "group-data-[status=destructive]/metric-strip-item:before:bg-destructive",
        "group-data-[status=info]/metric-strip-item:before:bg-info",
        "[&_svg]:ml-1.5 [&_svg]:inline-block [&_svg]:size-3.5 [&_svg]:align-[-0.125em]",
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
        "@xl:max-w-full @xl:shrink @xl:text-left @xl:whitespace-normal",
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

const badgeVariants = cva("ml-1.5 px-1.5 align-middle font-mono text-[10px]", {
  variants: {
    variant: {
      default: "border-border",
      increase:
        "border-destructive/20 bg-destructive/10 hover:bg-destructive/10 text-destructive",
      decrease:
        "border-success/20 bg-success/10 hover:bg-success/10 text-success",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/** Trend against the previous period; `value` is the ratio (1 = unchanged). */
export function MetricStripBadge({
  value,
  decimal = 1,
  className,
  ...props
}: React.ComponentProps<typeof Badge> & {
  value: number;
  decimal?: number;
}) {
  const round = 10 ** decimal;
  const percentage = Math.round((value - 1) * 100 * round) / round;

  const variant: VariantProps<typeof badgeVariants>["variant"] =
    percentage > 0 ? "increase" : percentage < 0 ? "decrease" : "default";

  return (
    <Badge
      data-slot="metric-strip-badge"
      variant="secondary"
      className={badgeVariants({ variant, className })}
      {...props}
    >
      {percentage !== 0 ? (
        <span>
          {percentage > 0 ? <ChevronUp className="mr-px size-2.5" /> : null}
          {percentage < 0 ? <ChevronDown className="mr-px size-2.5" /> : null}
        </span>
      ) : null}
      {Math.abs(percentage)}%
    </Badge>
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
