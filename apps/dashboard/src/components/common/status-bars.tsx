import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

import type { StatusVariant } from "./status-dot";

const statusBarsVariants = cva(
  "inline-flex shrink-0 items-end gap-px *:w-[3px] *:rounded-[1px] *:bg-current",
  {
    variants: {
      variant: {
        default: "text-muted-foreground",
        success: "text-success",
        warning: "text-warning",
        destructive: "text-destructive",
        info: "text-info",
      } satisfies Record<StatusVariant, string>,
    },
    defaultVariants: { variant: "default" },
  },
);

const HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"] as const;

/** Signal-strength glyph: `level` of three bars filled, the rest faded. */
export function StatusBars({
  level,
  variant,
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof statusBarsVariants> & { level: 0 | 1 | 2 | 3 }) {
  return (
    <span
      data-slot="status-bars"
      aria-hidden="true"
      className={cn(statusBarsVariants({ variant }), className)}
      {...props}
    >
      {HEIGHTS.map((height, i) => (
        <span key={height} className={cn(height, i >= level && "opacity-25")} />
      ))}
    </span>
  );
}
