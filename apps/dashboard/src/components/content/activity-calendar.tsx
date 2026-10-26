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
import { Fragment, useEffect, useRef, useState } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

import {
  type ActivityMark,
  ActivityTooltip,
  activityColorVariants,
} from "./activity";

export type ActivityLink = {
  href: string;
  title: string;
  kind?: string;
  /** Mono aside after the title, e.g. "12m". */
  meta?: string;
};

export type ActivityDay = Partial<ActivityMark> & {
  date: Date;
  /** Scheduled, not recorded: a dashed ring over the lightest planned fill. */
  upcoming?: boolean;
  /** Tooltip lines under the date; with the date they make the aria-label. */
  lines?: string[];
  /** Opens a popover on click listing these; `kind` labels each in a mixed calendar. */
  links?: ActivityLink[];
};

/** Sets the minimum cell size; the grid stretches cells to fill the width above it. */
export function ActivityCalendar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="activity-calendar"
      className={cn(
        "flex flex-col gap-3 [--activity-cell:12px] [--activity-gap:3px]",
        className,
      )}
      {...props}
    />
  );
}

const cellVariants = cva(
  cn(
    "aspect-square w-(--activity-cell) shrink-0 rounded-[3px] in-data-[slot=activity-calendar-grid]:w-full",
    // outside the cell, so the fill stays readable
    "data-[today]:outline-foreground data-[today]:outline-[1.5px] data-[today]:outline-offset-[1.5px] data-[today]:outline-solid",
  ),
  {
    variants: {
      upcoming: {
        // filled, so it differs from a bare future day by more than hue
        true: "border-info bg-activity-planned-1 border border-dashed",
      },
    },
  },
);

export function ActivityCalendarCell({
  scale,
  level,
  hatched,
  upcoming,
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof activityColorVariants> &
  VariantProps<typeof cellVariants>) {
  return (
    <div
      data-slot="activity-calendar-cell"
      className={cn(
        activityColorVariants({ scale, level, hatched }),
        cellVariants({ upcoming }),
        className,
      )}
      {...props}
    />
  );
}

const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];
const DAYS_PER_WEEK = 7;
const WEEK_MS = DAYS_PER_WEEK * 24 * 60 * 60 * 1000;
// a month label needs this many columns so it never runs into the next one
const MIN_MONTH_COLUMNS = 3;
const STICKY =
  "bg-background sticky left-0 z-10 shadow-[0_0_0_var(--activity-gap)_var(--background)]";
// columns are weeks, rows are weekdays
const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -DAYS_PER_WEEK,
  ArrowRight: DAYS_PER_WEEK,
  ArrowUp: -1,
  ArrowDown: 1,
};

/**
 * Weeks as columns, Monday on top; days after today are outlines unless scheduled.
 * Dates render after hydration so the server's timezone never reaches the first paint.
 */
export function ActivityCalendarGrid({
  days,
  today = new Date(),
  className,
  style,
  onKeyDown,
  onFocus,
  ...props
}: React.ComponentProps<"div"> & { days: ActivityDay[]; today?: Date }) {
  const hydrated = useHydrated();
  const weeks = toWeeks(days);
  const months = monthLabels(weeks);
  const scroller = useRef<HTMLDivElement>(null);
  const todayIndex = days.findIndex((day) => isSameDay(day.date, today));
  // roving tabindex: one cell in the tab order, arrows move it
  const [active, setActive] = useState<number | null>(null);
  const current = active ?? (todayIndex >= 0 ? todayIndex : days.length - 1);

  // newest week first when the grid is wider than the viewport
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  function onArrow(e: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    const step = ARROW_STEPS[e.key];
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!step || !from) return;
    e.preventDefault();
    const start = Number(from.dataset.index);
    // up/down stay in the week's column
    const row = (i: number) => (days[i].date.getDay() + 6) % DAYS_PER_WEEK;
    // blank future days aren't buttons: hop over them
    for (let i = start + step; i >= 0 && i < days.length; i += step) {
      if (Math.abs(step) === 1 && row(i) !== row(i - step) + step) return;
      const next = scroller.current?.querySelector<HTMLElement>(
        `button[data-index="${i}"]`,
      );
      if (next) {
        next.focus();
        return;
      }
    }
  }

  return (
    <div ref={scroller} className="relative overflow-x-auto">
      <div
        data-slot="activity-calendar-grid"
        // as wide as its weeks, or the sticky weekdays scroll away with the box
        className={cn(
          "grid w-max min-w-full grid-flow-col gap-(--activity-gap) p-[3px]",
          className,
        )}
        style={{
          gridTemplateRows: `auto repeat(${DAYS_PER_WEEK}, auto)`,
          gridTemplateColumns: `auto repeat(${weeks.length}, minmax(var(--activity-cell), 1fr))`,
          ...style,
        }}
        {...props}
        onKeyDown={onArrow}
        // the tab stop follows the last cell focused, by click or arrow
        onFocus={(e) => {
          onFocus?.(e);
          const index = (e.target as HTMLElement).dataset.index;
          if (index !== undefined) setActive(Number(index));
        }}
      >
        {/* the spread shadow covers cells peeking through the gaps */}
        <div className={STICKY} />
        {WEEKDAYS.map((label, i) => (
          <div
            key={i}
            className={cn(
              STICKY,
              "text-muted-foreground flex items-center pr-1 font-mono text-xs leading-none",
            )}
          >
            {label}
          </div>
        ))}
        {weeks.map((week, w) => (
          <Fragment key={w}>
            <div className="text-muted-foreground h-3.5 w-0 font-mono text-xs leading-none whitespace-nowrap">
              {hydrated ? months[w] : null}
            </div>
            {week.map((slot, d) =>
              slot ? (
                <ActivityCalendarDay
                  key={slot.day.date.getTime()}
                  day={slot.day}
                  index={slot.index}
                  today={today}
                  hydrated={hydrated}
                  tabbable={slot.index === current}
                  // which of these is past today isn't known before hydration
                  recent={slot.day.date.getTime() > today.getTime() - WEEK_MS}
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
  index,
  today,
  hydrated,
  tabbable,
  recent,
}: {
  day: ActivityDay;
  index: number;
  today: Date;
  hydrated: boolean;
  tabbable: boolean;
  recent: boolean;
}) {
  if (!hydrated) {
    return <ActivityCalendarCell className={cn(recent && "invisible")} />;
  }
  // after today: empty days are a bare outline, scheduled ones filled and dashed blue
  const future = day.date > today;
  // not a button, so arrow keys hop over it
  if (future && !day.upcoming && day.scale === undefined) {
    return (
      <div
        aria-hidden
        className={cn(
          cellVariants(),
          "border-border border border-dashed bg-transparent",
        )}
      />
    );
  }
  const upcoming = day.upcoming || future;
  const date = format(day.date, "EEE, MMM d");
  const lines = day.lines ?? [];
  const linked = !!day.links?.length;
  const kinds = day.links?.some((link) => link.kind);
  const cell = (
    <button
      type="button"
      data-slot="activity-calendar-cell"
      data-index={index}
      data-today={isSameDay(day.date, today) ? "" : undefined}
      aria-label={[date, ...lines].join(" · ")}
      tabIndex={tabbable ? 0 : -1}
      className={cn(
        activityColorVariants({
          scale: day.scale,
          level: day.level,
          hatched: day.hatched,
        }),
        cellVariants({ upcoming }),
        "ring-offset-background hover:ring-ring focus-visible:ring-ring outline-none hover:ring-[1.5px] hover:ring-offset-[1.5px] focus-visible:ring-[1.5px] focus-visible:ring-offset-[1.5px]",
        linked ? "cursor-pointer" : "cursor-default",
      )}
    />
  );
  // truncate inside: overflow on the content itself would clip the arrow
  const tooltip = (
    <TooltipContent side="top">
      <ActivityTooltip date={date} lines={lines} />
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
      <PopoverContent
        side="top"
        className={cn("w-auto p-1", kinds ? "max-w-80" : "max-w-72")}
      >
        <div className="text-muted-foreground px-2 py-1 font-mono text-xs">
          {date}
        </div>
        {/* subgrid: the label column is as wide as this popover's longest label */}
        <ul
          className={cn(
            "grid gap-x-2",
            kinds ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1",
          )}
        >
          {day.links?.map((link) => (
            <li key={link.href} className="col-span-full grid grid-cols-subgrid">
              <NextLink
                href={link.href}
                className="hover:bg-muted focus-visible:bg-muted col-span-full grid grid-cols-subgrid items-baseline gap-x-2 rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                {kinds ? (
                  <span className="text-muted-foreground font-mono text-xs uppercase">
                    {link.kind}
                  </span>
                ) : null}
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate">
                    {link.title.trim() || (
                      <span className="text-muted-foreground/50">No title</span>
                    )}
                  </span>
                  {link.meta ? (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {link.meta}
                    </span>
                  ) : null}
                </span>
              </NextLink>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type Slot = { day: ActivityDay; index: number } | null;

function toWeeks(days: ActivityDay[]): Slot[][] {
  const first = days[0];
  const offset = first ? (first.date.getDay() + 6) % 7 : 0;
  const padded: Slot[] = [
    ...Array.from({ length: offset }, () => null),
    ...days.map((day, index) => ({ day, index })),
  ];
  while (padded.length % DAYS_PER_WEEK) padded.push(null);
  const weeks: Slot[][] = [];
  for (let i = 0; i < padded.length; i += DAYS_PER_WEEK) {
    weeks.push(padded.slice(i, i + DAYS_PER_WEEK));
  }
  return weeks;
}

/** Month name on the first column of each month that has room for it. */
function monthLabels(weeks: Slot[][]): (string | null)[] {
  const starts: { column: number; label: string }[] = [];
  let current: string | null = null;
  weeks.forEach((week, column) => {
    const slot = week.find((d) => d !== null);
    if (!slot) return;
    const label = format(slot.day.date, "MMM");
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
        "text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs",
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
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

/** Off-scale states (canceled, upcoming) go after this. */
export function ActivityCalendarLegendSeparator({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="activity-calendar-legend-separator"
      aria-hidden
      className={cn("bg-border h-3 w-px", className)}
      {...props}
    />
  );
}
