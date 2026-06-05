import { cn } from "@openstatus/ui/lib/utils";
import type { ReactNode } from "react";

type Props = {
  label: ReactNode;
  value?: ReactNode;
  className?: string;
  /** Visual emphasis. `default` matches the audit-log palette. */
  variant?: "default" | "outline";
};

/**
 * Two-part chip: muted label cell + mono value cell, separated by a
 * vertical border. Returns `null` when `value` is empty so callers can map
 * over a heterogeneous metadata bag without filtering first.
 */
export function Pill({ label, value, className, variant = "default" }: Props) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
        className,
      )}
    >
      <div
        className={cn(
          "border-r py-0.5 pr-1 pl-2 text-foreground/70",
          variant === "default" && "bg-muted",
        )}
      >
        {label}
      </div>
      <div className="py-0.5 pr-2 pl-1 font-mono">{value}</div>
    </div>
  );
}
