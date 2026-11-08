import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

/*
 * Every part is positioned in CSS from `--max` (set once on `RangePlot`) and
 * its own `--value`, so rows on the same `max` share one axis without context.
 * Values past `max` clamp to the edge; flag them with `RangePlotOverflow`.
 */
const AT = "left-[calc(min(var(--value),var(--max))/var(--max)*100%)]";

function vars(values: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`--${key}`, value]),
  ) as React.CSSProperties;
}

export function RangePlot({
  max,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { max: number }) {
  return (
    <div
      data-slot="range-plot"
      className={cn("@container relative h-5 w-full", className)}
      style={{ ...vars({ max }), ...style }}
      {...props}
    />
  );
}

/** Vertical lines at 0, half and max; bleeds into the cell padding so stacked rows join. */
export function RangePlotGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="range-plot-grid"
      aria-hidden
      className={cn(
        "*:bg-border pointer-events-none absolute inset-x-0 -inset-y-2 *:absolute *:inset-y-0 *:w-px",
        className,
      )}
      {...props}
    >
      <div className="left-0" />
      <div className="left-1/2" />
      <div className="right-0" />
    </div>
  );
}

/** Axis labels for a header cell: 0, half and max with the unit. */
export function RangePlotAxis({
  max,
  unit,
  className,
  ...props
}: React.ComponentProps<"div"> & { max: number; unit?: string }) {
  return (
    <div
      data-slot="range-plot-axis"
      className={cn(
        "text-muted-foreground relative h-4 w-full font-mono text-xs font-normal tabular-nums",
        className,
      )}
      {...props}
    >
      <span className="absolute left-0">0</span>
      <span className="absolute left-1/2 -translate-x-1/2">{max / 2}</span>
      <span className="absolute right-0">
        {max}
        {unit}
      </span>
    </div>
  );
}

/** Vertical line at a value (e.g. a degraded threshold); bleeds into the cell padding like the grid so rows join. */
export function RangePlotThreshold({
  value,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { value: number }) {
  return (
    <div
      data-slot="range-plot-threshold"
      aria-hidden
      className={cn(
        "border-warning/60 pointer-events-none absolute -inset-y-2 w-0 border-l",
        AT,
        className,
      )}
      style={{ ...vars({ value }), ...style }}
      {...props}
    />
  );
}

const rangeVariants = cva(
  "absolute top-1/2 right-[calc(100%_-_min(var(--to),var(--max))/var(--max)*100%)] left-[calc(min(var(--from),var(--max))/var(--max)*100%)] -translate-y-1/2",
  {
    variants: {
      variant: {
        whisker: "bg-muted-foreground/50 h-px",
        box: "border-muted-foreground/50 bg-muted h-2.5 rounded-xs border",
      },
    },
    defaultVariants: { variant: "whisker" },
  },
);

export function RangePlotRange({
  from,
  to,
  variant,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof rangeVariants> & { from: number; to: number }) {
  return (
    <div
      data-slot="range-plot-range"
      data-variant={variant ?? "whisker"}
      aria-hidden
      className={cn(rangeVariants({ variant }), className)}
      style={{ ...vars({ from, to }), ...style }}
      {...props}
    />
  );
}

const markerVariants = cva(
  "bg-foreground absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
  {
    variants: {
      variant: {
        dot: "bg-muted-foreground size-2",
        tick: "h-3 w-0.5",
        end: "bg-muted-foreground h-2 w-px",
      },
    },
    defaultVariants: { variant: "dot" },
  },
);

export function RangePlotMarker({
  value,
  variant,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof markerVariants> & { value: number }) {
  return (
    <div
      data-slot="range-plot-marker"
      data-variant={variant ?? "dot"}
      aria-hidden
      className={cn(markerVariants({ variant }), AT, className)}
      style={{ ...vars({ value }), ...style }}
      {...props}
    />
  );
}

/** Pinned to the right edge when a value runs past `max`. */
export function RangePlotOverflow({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="range-plot-overflow"
      className={cn(
        "bg-foreground text-background absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-1 rounded-sm px-1 py-0.5 font-mono text-xs leading-none tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function RangePlotEmpty({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="range-plot-empty"
      className={cn(
        "text-muted-foreground absolute inset-0 flex items-center truncate pl-2 font-mono text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function RangePlotLegend({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="range-plot-legend"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs",
        className,
      )}
      {...props}
    />
  );
}

const swatchVariants = cva("bg-foreground shrink-0 rounded-full", {
  variants: {
    variant: {
      dot: "bg-muted-foreground size-2",
      tick: "h-3 w-0.5",
      end: "bg-muted-foreground h-2 w-px",
      box: "border-muted-foreground/50 bg-muted h-2.5 w-3 rounded-xs border",
      warning: "border-warning h-3 w-0 rounded-none border-l bg-transparent",
    },
  },
  defaultVariants: { variant: "dot" },
});

export function RangePlotLegendItem({
  variant,
  className,
  children,
  ...props
}: React.ComponentProps<"li"> & VariantProps<typeof swatchVariants>) {
  return (
    <li
      data-slot="range-plot-legend-item"
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    >
      <span aria-hidden className={cn(swatchVariants({ variant }))} />
      {children}
    </li>
  );
}

/** px offsets inside the 26px icon: whisker ends, box edges and middle. */
const POSITIONS = { min: 2, start: 8, mid: 13, end: 18, max: 24 } as const;

const positionDotVariants = cva(
  "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
  {
    variants: {
      variant: {
        default: "bg-foreground",
        warning: "bg-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** A miniature of the plot (whisker + box) with one dot where a percentile sits. */
export function RangePlotPositionIcon({
  at,
  variant,
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof positionDotVariants> & { at: keyof typeof POSITIONS }) {
  return (
    <span
      data-slot="range-plot-position-icon"
      aria-hidden
      className={cn("relative h-2.5 w-[26px] shrink-0", className)}
      {...props}
    >
      <span className="bg-muted-foreground/50 absolute inset-x-[2px] top-1/2 h-px -translate-y-1/2" />
      <span className="border-muted-foreground/50 bg-muted absolute top-1/2 left-[8px] h-1.5 w-2.5 -translate-y-1/2 rounded-xs border" />
      <span
        className={positionDotVariants({ variant })}
        style={{ left: POSITIONS[at] }}
      />
    </span>
  );
}
