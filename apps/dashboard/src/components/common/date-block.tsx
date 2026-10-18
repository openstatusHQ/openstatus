"use client";

import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { format } from "date-fns";

import { useHydrated } from "@/hooks/use-hydrated";

import type { StatusVariant } from "./status-dot";

const dateBlockVariants = cva(
  "flex w-8 shrink-0 flex-col items-center leading-none",
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
    defaultVariants: {
      variant: "default",
    },
  },
);

/** Weekday over day of month; `variant` colours the weekday. */
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
      <span className="text-foreground mt-1 text-sm font-medium tabular-nums">
        {hydrated ? format(date, "d") : null}
      </span>
    </time>
  );
}
