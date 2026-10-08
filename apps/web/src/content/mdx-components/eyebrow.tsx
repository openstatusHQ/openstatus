import { type VariantProps, cva } from "class-variance-authority";
import type React from "react";

import { cn } from "@/lib/utils";

const markerVariants = cva(
  "border-muted-foreground bg-background absolute top-0.5 -left-6 hidden size-[11px] border in-data-[slot=timeline]:block md:-left-10",
  {
    variants: {
      status: {
        investigating: "border-destructive bg-destructive",
        identified: "border-warning bg-warning",
        monitoring: "border-info bg-info",
        resolved: "border-success bg-success",
      },
    },
  },
);

/**
 * Small label on the line before a heading (a timestamp, a step, a category);
 * `globals.css` hands it the heading's top rule. Styled like `CellLabel`.
 * Inside a `Timeline` it renders a rail marker colored by `status`.
 */
export function Eyebrow({
  status,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return (
    <div
      data-slot="eyebrow"
      className={cn(
        "text-muted-foreground text-xs tracking-widest uppercase tabular-nums",
        className,
      )}
      {...props}
    >
      {/* `cn` lets the status colors override the hollow default. */}
      <span aria-hidden className={cn(markerVariants({ status }))} />
      {children}
    </div>
  );
}
