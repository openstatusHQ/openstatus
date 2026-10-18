"use client";

import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { format } from "date-fns";

import { useHydrated } from "@/hooks/use-hydrated";

import type { StatusVariant } from "./status-dot";

const dateBlockVariants = cva(
  "flex w-10 shrink-0 flex-col items-center gap-0.5 rounded-md border py-1",
  {
    variants: {
      variant: {
        default: "bg-muted/50",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-info/20 bg-info/10 text-info",
      } satisfies Record<StatusVariant, string>,
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/** Calendar tile: weekday over day of month, tinted by `variant`. */
export function DateBlock({
  date,
  variant,
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "dateTime" | "children"> &
  VariantProps<typeof dateBlockVariants> & { date: Date }) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  return (
    <time
      data-slot="date-block"
      dateTime={date.toISOString()}
      className={cn(dateBlockVariants({ variant }), className)}
      {...props}
    >
      <span className="font-mono text-xs uppercase">
        {hydrated ? format(date, "EEE") : null}
      </span>
      <span className="text-foreground text-sm font-medium tabular-nums">
        {hydrated ? format(date, "d") : null}
      </span>
    </time>
  );
}
