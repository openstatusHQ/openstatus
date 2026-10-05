"use client";

import { format } from "date-fns";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

export function TableCellDate({
  value,
  className,
  formatStr = "LLL dd, y HH:mm:ss",
  ...props
}: React.ComponentProps<"div"> & { value: unknown; formatStr?: string }) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  if (value instanceof Date) {
    return (
      <HoverCardTimestamp date={value}>
        <div className={cn("text-muted-foreground", className)} {...props}>
          {hydrated ? format(value, formatStr) : null}
        </div>
      </HoverCardTimestamp>
    );
  }
  if (typeof value === "string") {
    return (
      <div className={cn("text-muted-foreground", className)} {...props}>
        {value}
      </div>
    );
  }
  return (
    <div className={cn("text-muted-foreground", className)} {...props}>
      -
    </div>
  );
}
