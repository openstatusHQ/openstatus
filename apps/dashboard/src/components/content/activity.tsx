import { cva } from "class-variance-authority";

import type { StatusVariant } from "@/components/common/status-dot";
import { cn } from "@/lib/utils";

/**
 * One color recipe for every activity mark (calendar cell, lane tick): the
 * variant sets `--activity-color`, the level mixes it into the background.
 */
export const activityColorVariants = cva("", {
  variants: {
    variant: {
      default: "[--activity-color:var(--muted-foreground)]",
      success: "[--activity-color:var(--success)]",
      warning: "[--activity-color:var(--warning)]",
      destructive: "[--activity-color:var(--destructive)]",
      info: "[--activity-color:var(--info)]",
    } satisfies Record<StatusVariant, string>,
    level: {
      0: "bg-muted",
      1: "bg-[color-mix(in_oklab,var(--activity-color)_40%,var(--background))]",
      2: "bg-[color-mix(in_oklab,var(--activity-color)_70%,var(--background))]",
      3: "bg-(--activity-color)",
    },
  },
  defaultVariants: { variant: "default", level: 0 },
});

export type ActivityLevel = 0 | 1 | 2 | 3;

export function Activity({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="activity"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

export function ActivityHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-header"
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

export function ActivityTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="activity-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

/** The window on the right, quiet like a group hint. */
export function ActivityPeriod({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="activity-period"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}
