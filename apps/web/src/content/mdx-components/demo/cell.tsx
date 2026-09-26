import type React from "react";

import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "destructive" | "info" | "muted";

export const toneClass: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  muted: "text-muted-foreground",
};

/**
 * The one visual grammar every demo is built from: a bordered mono box whose
 * direct children stack with a 1px rule between them. No radius, no shadow.
 */
export function Cell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell"
      className={cn(
        "not-prose border-border bg-background text-foreground border text-sm",
        "[&>*+*]:border-border [&>*+*]:border-t",
        className,
      )}
      {...props}
    />
  );
}

export function CellHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell-header"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export function CellTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="cell-title"
      className={cn("text-foreground font-medium", className)}
      {...props}
    />
  );
}

export function CellDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="cell-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

/** Muted band that names the rows below it. */
export function CellSubheader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CellLabel
      data-slot="cell-subheader"
      className={cn("bg-muted px-4 py-1.5", className)}
      {...props}
    />
  );
}

export function CellBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell-body"
      className={cn("px-4 py-3", className)}
      {...props}
    />
  );
}

export function CellRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell-row"
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export function CellFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell-footer"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function CellLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell-label"
      className={cn(
        "text-muted-foreground text-[11px] tracking-widest uppercase",
        className,
      )}
      {...props}
    />
  );
}

/** Headline number under a `CellLabel`. */
export function CellMetric({
  tone,
  className,
  ...props
}: React.ComponentProps<"div"> & { tone?: Tone }) {
  return (
    <div
      data-slot="cell-metric"
      className={cn("text-lg", tone && toneClass[tone], className)}
      {...props}
    />
  );
}

export function CellPre({ className, ...props }: React.ComponentProps<"pre">) {
  return (
    <pre
      data-slot="cell-pre"
      className={cn(
        "bg-muted overflow-x-auto px-4 py-3 text-xs leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

const gridCols = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};
const gridColsSm = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

/** Equal cells separated by 1px rules; `sm` widens the column count from the `sm` breakpoint. */
export function CellGrid({
  cols = 2,
  sm,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  cols?: keyof typeof gridCols;
  sm?: keyof typeof gridColsSm;
}) {
  return (
    <div
      data-slot="cell-grid"
      className={cn(
        "bg-border grid gap-px",
        gridCols[cols],
        sm && gridColsSm[sm],
        className,
      )}
      {...props}
    />
  );
}

export function CellGridItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="cell-grid-item"
      className={cn("bg-background px-4 py-2", className)}
      {...props}
    />
  );
}

/** Two-column key/value list; `CellKey` and `CellValue` are its direct children. */
export function CellKeyValues({
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="cell-key-values"
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 px-4 py-2 text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function CellKey({ className, ...props }: React.ComponentProps<"dt">) {
  return (
    <dt
      data-slot="cell-key"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CellValue({ className, ...props }: React.ComponentProps<"dd">) {
  return <dd data-slot="cell-value" className={className} {...props} />;
}
