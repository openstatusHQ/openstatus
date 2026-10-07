import type React from "react";

import { cn } from "@/lib/utils";

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
}: React.ComponentProps<"div"> & {
  status?: "investigating" | "identified" | "monitoring" | "resolved";
}) {
  return (
    <div
      data-slot="eyebrow"
      className={cn(
        "text-muted-foreground text-xs tracking-widest uppercase tabular-nums",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        data-status={status}
        className={cn(
          "absolute top-0.5 -left-6 hidden size-[11px] md:-left-10",
          "in-data-[slot=timeline]:block",
          "border-muted-foreground bg-background border",
          "data-[status=investigating]:bg-destructive data-[status=investigating]:border-destructive",
          "data-[status=identified]:bg-warning data-[status=identified]:border-warning",
          "data-[status=monitoring]:bg-info data-[status=monitoring]:border-info",
          "data-[status=resolved]:bg-success data-[status=resolved]:border-success",
        )}
      />
      {children}
    </div>
  );
}
