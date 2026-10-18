import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

import type { StatusVariant } from "./status-dot";

const severityBarVariants = cva("", {
  variants: {
    variant: {
      default: "bg-muted-foreground",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
      info: "bg-info",
    } satisfies Record<StatusVariant, string>,
  },
  defaultVariants: {
    variant: "default",
  },
});

const heights = ["h-2", "h-3", "h-4"];

/** Three rising bars, the first `level` (0–3) filled; `label` names it for screen readers. */
export function SeverityBars({
  level,
  label,
  variant,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof severityBarVariants> & {
    level: 0 | 1 | 2 | 3;
    label: string;
  }) {
  return (
    <span
      data-slot="severity-bars"
      role="img"
      aria-label={label}
      className={cn("inline-flex h-4 items-end gap-0.5", className)}
      {...props}
    >
      {heights.map((height, i) => (
        <span
          key={height}
          className={cn(
            "w-1 rounded-xs",
            height,
            i < level
              ? severityBarVariants({ variant })
              : "bg-muted-foreground/20",
          )}
        />
      ))}
    </span>
  );
}
