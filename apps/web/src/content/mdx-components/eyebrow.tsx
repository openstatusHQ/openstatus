import type React from "react";

import { cn } from "@/lib/utils";

/**
 * Small label on the line before a heading (a timestamp, a step, a category);
 * `globals.css` hands it the heading's top rule. Styled like `CellLabel`.
 */
export function Eyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="eyebrow"
      className={cn(
        "text-muted-foreground text-xs tracking-widest uppercase tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
