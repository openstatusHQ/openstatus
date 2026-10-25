"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { type VariantProps, cva } from "class-variance-authority";
import { format, isSameDay } from "date-fns";
import NextLink from "next/link";
import { Fragment, useEffect, useRef } from "react";

import type { StatusVariant } from "@/components/common/status-dot";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

import { type ActivityLevel, activityColorVariants } from "./activity";

export type ActivityDay = {
  date: Date;
  variant?: StatusVariant;
  level?: ActivityLevel;
  /** Drawn as a ring instead of a fill: something scheduled, not recorded. */
  outline?: boolean;
  label?: string;
  /** Opens a popover on click listing these, e.g. the reports behind the mark. */
  links?: { href: string; title: string }[];
};

/** Sets the cell scale; the grid stretches cells to fill the width above it. */
export function ActivityCalendar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-calendar"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-3 rounded-lg border p-3 [--activity-cell:10px] [--activity-gap:3px]",
        className,
      )}
      {...props}
    />
  );
}

const cellVariants = cva(
  cn(
    "aspect-square w-(--activity-cell) rounded-xs in-data-[slot=activity-calendar-grid]:w-full",
    "data-[today]:outline-foreground/70 data-[today]:outline-1 data-[today]:-outline-offset-1 data-[today]:outline-solid",
  ),
  {
    variants: {
      outline: {
        true: "bg-transparent ring-1 ring-(--activity-color) ring-inset",
      },
    },
  },
);

export function ActivityCalendarCell({
  variant,
  level,
  outline,
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof activityColorVariants> &
  VariantProps<typeof cellVariants>) {
  return (
    <div
      data-slot="activity-calendar-cell"
      className={cn(
        activityColorVariants({ variant, level }),
        cellVariants({ outline }),
        className,
      )}
      {...props}
    />
  );
}

const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];
const DAYS_PER_WEEK = 7;
// a month label needs this many columns so it never runs into the next one
const MIN_MONTH_COLUMNS = 3;

/**
 * Weeks as columns, Monday on top. `days` is consecutive; the first week is
 * padded back to Monday. Dates and tooltips render after hydration so the
 * server's timezone never leaks into the first paint.
 */
export function ActivityCalendarGrid({
  days,
  today = new Date(),
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { days: ActivityDay[]; today?: Date }) {
  const hydrated = useHydrated();
  const weeks = toWeeks(days);
  const months = monthLabels(weeks);
  const scroller = useRef<HTMLDivElement>(null);

  // newest week first when the grid is wider than the viewport
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={scroller} className="overflow-x-auto">
      <div
        data-slot="activity-calendar-grid"
        className={cn("grid grid-flow-col gap-(--activity-gap)", className)}
        style={{
          gridTemplateRows: `auto repeat(${DAYS_PER_WEEK}, auto)`,
          gridTemplateColumns: `auto repeat(${weeks.length}, minmax(var(--activity-cell), 1fr))`,
          ...style,
        }}
        {...props}
      >
        <div />
        {WEEKDAYS.map((label, i) => (
          <div
            key={i}
            className="text-muted-foreground flex items-center pr-1 font-mono text-xs leading-none"
          >
            {label}
          </div>
        ))}
        {weeks.map((week, w) => (
          <Fragment key={w}>
            <div className="text-muted-foreground h-3.5 font-mono text-xs leading-none whitespace-nowrap">
              {hydrated ? months[w] : null}
            </div>
            {week.map((day, d) =>
              day ? (
                <ActivityCalendarDay
                  key={day.date.getTime()}
                  day={day}
                  today={today}
                  hydrated={hydrated}
                />
              ) : (
                <div key={d} />
              ),
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function ActivityCalendarDay({
  day,
  today,
  hydrated,
}: {
  day: ActivityDay;
  today: Date;
  hydrated: boolean;
}) {
  if (!hydrated) return <ActivityCalendarCell />;
  const linked = !!day.label && !!day.links?.length;
  const cell = (
    <ActivityCalendarCell
      variant={day.variant}
      level={day.level}
      outline={day.outline}
      data-today={isSameDay(day.date, today) ? "" : undefined}
      role={linked ? "button" : undefined}
      // a div trigger: Enter/Space don't click it natively
      onKeyDown={
        linked
          ? (e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.currentTarget.click();
            }
          : undefined
      }
      // reachable from the keyboard only when there is something to read
      tabIndex={day.level || day.outline ? 0 : undefined}
      className={cn(
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        linked && "cursor-pointer",
      )}
    >
      {day.label ? <span className="sr-only">{day.label}</span> : null}
    </ActivityCalendarCell>
  );
  if (!day.label) return cell;
  // truncate inside: overflow on the content itself would clip the arrow
  const tooltip = (
    <TooltipContent side="top">
      <span className="block max-w-72 truncate">{day.label}</span>
    </TooltipContent>
  );
  if (!linked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{cell}</TooltipTrigger>
        {tooltip}
      </Tooltip>
    );
  }
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{cell}</PopoverTrigger>
        </TooltipTrigger>
        {tooltip}
      </Tooltip>
      <PopoverContent side="top" className="w-auto max-w-72 p-1">
        <div className="text-muted-foreground px-2 py-1 font-mono text-xs">
          {format(day.date, "EEE, MMM d")}
        </div>
        <ul>
          {day.links?.map((link) => (
            <li key={link.href}>
              <NextLink
                href={link.href}
                className="hover:bg-muted focus-visible:bg-muted block truncate rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                {link.title.trim() || (
                  <span className="text-muted-foreground/50">No title</span>
                )}
              </NextLink>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function toWeeks(days: ActivityDay[]): (ActivityDay | null)[][] {
  const first = days[0];
  const offset = first ? (first.date.getDay() + 6) % 7 : 0;
  const padded: (ActivityDay | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...days,
  ];
  while (padded.length % DAYS_PER_WEEK) padded.push(null);
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += DAYS_PER_WEEK) {
    weeks.push(padded.slice(i, i + DAYS_PER_WEEK));
  }
  return weeks;
}

/** Month name on the first column of each month that has room for it. */
function monthLabels(weeks: (ActivityDay | null)[][]): (string | null)[] {
  const starts: { column: number; label: string }[] = [];
  let current: string | null = null;
  weeks.forEach((week, column) => {
    const day = week.find((d) => d !== null);
    if (!day) return;
    const label = format(day.date, "MMM");
    if (label !== current) {
      starts.push({ column, label });
      current = label;
    }
  });
  const labels: (string | null)[] = weeks.map(() => null);
  starts.forEach(({ column, label }, i) => {
    const next = starts[i + 1]?.column ?? weeks.length;
    if (next - column >= MIN_MONTH_COLUMNS) labels[column] = label;
  });
  return labels;
}

export function ActivityCalendarLegend({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="activity-calendar-legend"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function ActivityCalendarLegendItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="activity-calendar-legend-item"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
}
