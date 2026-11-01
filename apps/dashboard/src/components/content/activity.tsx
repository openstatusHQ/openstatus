import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * One color recipe for every activity mark (calendar cell, lane tick): the
 * scale picks the hue, the level its lightness, so the marks read in grayscale.
 */
export const activityColorVariants = cva("", {
  variants: {
    scale: { failure: "", planned: "" },
    level: { 0: "bg-activity-0", 1: "", 2: "", 3: "" },
    /** No severity to show: untriaged or canceled. */
    hatched: {
      true: "bg-activity-0 bg-[image:repeating-linear-gradient(-45deg,var(--activity-hatch)_0_1px,transparent_1px_3px)]",
    },
  },
  compoundVariants: [
    { scale: "failure", level: 1, className: "bg-activity-1" },
    { scale: "failure", level: 2, className: "bg-activity-2" },
    { scale: "failure", level: 3, className: "bg-activity-3" },
    { scale: "planned", level: 1, className: "bg-activity-planned-1" },
    { scale: "planned", level: 2, className: "bg-activity-planned-2" },
    { scale: "planned", level: 3, className: "bg-activity-planned-3" },
  ],
  defaultVariants: { scale: "failure", level: 0 },
});

export type ActivityLevel = 0 | 1 | 2 | 3;
export type ActivityScale = "failure" | "planned";
export type ActivityMark = {
  scale: ActivityScale;
  level: ActivityLevel;
  hatched?: boolean;
};

/** Tooltip body for a calendar cell or lane tick: the date, the lead in bold, then the rest. */
export function ActivityTooltip({
  date,
  lines,
}: {
  date: string;
  lines: string[];
}) {
  return (
    <div className="flex max-w-72 flex-col gap-0.5">
      <span className="opacity-70">{date}</span>
      {lines.map((line, i) => (
        <span
          key={i}
          className={cn("truncate", i === 0 ? "font-medium" : "opacity-70")}
        >
          {line}
        </span>
      ))}
    </div>
  );
}

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
