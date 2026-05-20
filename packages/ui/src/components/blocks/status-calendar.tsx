"use client";

import {
  type Locale,
  addMonths,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DayPicker, type DayProps } from "react-day-picker";

import { StatusBarCard } from "@openstatus/ui/components/blocks/status-bar";
import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import type {
  StatusBarData,
  StatusEventType,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";

type BarEvent = StatusBarData["events"][number];

export interface StatusCalendarMarker {
  id: string | number;
  /** Day this marker belongs to, in the viewer's local timezone. */
  date: Date;
  /** Drives the day cell's ring color (worst-severity wins per day). */
  status: Exclude<StatusType, "empty">;
  /** Event shape mirrors StatusBarEvent so the popover can render the same row. */
  type: StatusEventType;
  name: string;
  /** Full event range (use the event's true start/end, not the per-day instance). */
  from?: Date | null;
  to?: Date | null;
  isAggregated?: boolean;
  href?: string;
}

export interface StatusCalendarProps {
  markers: StatusCalendarMarker[];
  /** Controlled month. Defaults to the first of the current month. */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** 0 = Sunday, 1 = Monday. Mockup shows Monday. */
  weekStartsOn?: 0 | 1;
  className?: string;
  /** Calendar header label on the left side of the chrome. */
  title?: ReactNode;
  /**
   * date-fns Locale used by DayPicker for weekday/month names. Callers should
   * pass the locale resolved from their i18n layer; defaults to en-US.
   */
  locale?: Locale;
  /** Override how a single marker row renders inside the hover card. */
  renderMarkerRow?: (marker: StatusCalendarMarker) => ReactNode;
}

const SEVERITY_RANK: Record<StatusCalendarMarker["status"], number> = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
};

const SEVERITY_RING: Record<StatusCalendarMarker["status"], string> = {
  error: "ring-2 ring-destructive text-destructive",
  degraded: "ring-2 ring-warning text-warning",
  info: "ring-2 ring-info text-info",
  success: "ring-2 ring-success text-success",
};

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function worstSeverity(
  markers: StatusCalendarMarker[],
): StatusCalendarMarker["status"] {
  return markers.reduce<StatusCalendarMarker["status"]>((worst, m) => {
    return SEVERITY_RANK[m.status] > SEVERITY_RANK[worst] ? m.status : worst;
  }, "success");
}

export function StatusCalendar({
  markers,
  month,
  defaultMonth,
  onMonthChange,
  weekStartsOn = 1,
  className,
  title,
  locale,
  renderMarkerRow,
}: StatusCalendarProps) {
  const labels = useStatusBlocksLabels();
  const resolvedTitle = title ?? labels.calendarTitle;
  const formatMonthYear = useCallback(
    (d: Date) => {
      // date-fns format reads its global locale (set by DateFnsProvider via
      // setDefaultOptions), so this picks up the active language without us
      // having to pass it explicitly here.
      return format(d, "MMM yyyy", locale ? { locale } : undefined);
    },
    [locale],
  );
  const [internalMonth, setInternalMonth] = useState<Date>(() =>
    startOfMonth(month ?? defaultMonth ?? new Date()),
  );
  const currentMonth = month ? startOfMonth(month) : internalMonth;

  const setMonth = (next: Date) => {
    const normalized = startOfMonth(next);
    if (month === undefined) setInternalMonth(normalized);
    onMonthChange?.(normalized);
  };

  const markersByDay = useMemo(() => {
    const map = new Map<string, StatusCalendarMarker[]>();
    for (const marker of markers) {
      const key = dayKey(marker.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(marker);
      else map.set(key, [marker]);
    }
    return map;
  }, [markers]);

  // Open state lives at the parent level: a per-day controlled HoverCard would
  // be lost if DayPicker decided to remount its day cells (e.g. during refetch-
  // driven parent re-renders). Tracking `activeDayKey` here keeps the popover
  // alive across remounts and re-renders.
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const requestOpen = useCallback(
    (key: string) => {
      cancelClose();
      setActiveDayKey(key);
    },
    [cancelClose],
  );
  const requestClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setActiveDayKey(null), 120);
  }, [cancelClose]);

  const renderMarkerRowRef = useRef(renderMarkerRow);
  useEffect(() => {
    renderMarkerRowRef.current = renderMarkerRow;
  }, [renderMarkerRow]);

  const Day = useCallback(
    (dayProps: DayProps) => (
      <CalendarDay
        {...dayProps}
        markersByDay={markersByDay}
        activeDayKey={activeDayKey}
        onRequestOpen={requestOpen}
        onRequestClose={requestClose}
        renderMarkerRowRef={renderMarkerRowRef}
      />
    ),
    [markersByDay, activeDayKey, requestOpen, requestClose],
  );

  const dayPickerComponents = useMemo(() => ({ Day }), [Day]);

  return (
    <div
      data-slot="status-calendar"
      className={cn(
        "flex flex-col rounded-lg border bg-card text-card-foreground",
        className,
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="font-medium text-sm">{resolvedTitle}</div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Previous month"
            onClick={() => setMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-center font-medium text-foreground tabular-nums">
            {formatMonthYear(currentMonth)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>
      <div className="border-t">
        <DayPicker
          mode="default"
          month={currentMonth}
          weekStartsOn={weekStartsOn}
          showOutsideDays={false}
          locale={locale}
          className="w-full"
          classNames={{
            months: "flex flex-col",
            month: "flex flex-col w-full",
            caption: "hidden",
            table: "w-full border-collapse",
            head_row: "flex w-full border-b",
            head_cell:
              "flex-1 text-muted-foreground font-normal text-[0.7rem] uppercase tracking-wide py-1.5",
            row: "flex w-full",
            cell: "flex-1 relative p-0 text-center text-sm border-r border-b last:border-r-0 focus-within:relative focus-within:z-20",
            day: cn(
              "inline-flex h-12 w-full items-center justify-center text-sm font-normal text-foreground/80 transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            ),
            day_today: "text-foreground font-semibold",
            day_outside: "text-muted-foreground/50",
            day_disabled: "text-muted-foreground/40 cursor-not-allowed",
            day_hidden: "invisible",
          }}
          components={dayPickerComponents}
        />
      </div>
    </div>
  );
}

interface CalendarDayProps extends DayProps {
  markersByDay: Map<string, StatusCalendarMarker[]>;
  activeDayKey: string | null;
  onRequestOpen: (key: string) => void;
  onRequestClose: () => void;
  renderMarkerRowRef: RefObject<
    ((marker: StatusCalendarMarker) => ReactNode) | undefined
  >;
}

const CalendarDay = forwardRef<HTMLElement, CalendarDayProps>(
  function CalendarDay(
    {
      date,
      displayMonth,
      markersByDay,
      activeDayKey,
      onRequestOpen,
      onRequestClose,
      renderMarkerRowRef,
    },
    forwardedRef,
  ) {
    // With `mode="default"`, useDayRender returns `isButton: false` for every
    // day — DayPicker only generates click handlers under a selection mode.
    // We don't need DayPicker's interactivity (we drive our own hover popover),
    // so we skip useDayRender entirely and render our own trigger.
    const thisDayKey = dayKey(startOfDay(date));
    const isOutside =
      startOfMonth(date).getTime() !== startOfMonth(displayMonth).getTime();

    // Overriding `components.Day` bypasses DayPicker's own hide-outside-days
    // logic — we have to drop these cells ourselves so the grid only shows the
    // current month.
    if (isOutside) {
      return <div data-day-state="outside" />;
    }

    const isToday = isSameDay(date, new Date());
    const dayMarkers = markersByDay.get(thisDayKey) ?? [];
    const severity =
      dayMarkers.length > 0 ? worstSeverity(dayMarkers) : undefined;
    const open = activeDayKey === thisDayKey;

    const hasMarkers = dayMarkers.length > 0;
    // Each cell is a full-width rectangle so adjacent borders form a grid.
    // Severity ring is inset so it sits inside the cell, not bleeding into
    // neighboring borders.
    const dayClass = cn(
      "inline-flex h-12 w-full items-center justify-center text-sm font-normal text-foreground/80 transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      isToday && "text-foreground font-semibold",
      severity && cn("font-medium ring-inset", SEVERITY_RING[severity]),
      hasMarkers && "cursor-pointer",
    );

    // Days without events render a plain trigger — no HoverCard, no popover.
    if (!hasMarkers) {
      return (
        <div
          ref={forwardedRef as RefObject<HTMLDivElement>}
          data-day={thisDayKey}
          data-day-state="empty"
          tabIndex={-1}
          className={dayClass}
        >
          {format(date, "d")}
        </div>
      );
    }

    const barItem: StatusBarData = {
      day: format(date, "yyyy-MM-dd"),
      bar: [],
      card: [],
      events: dayMarkers.map(markerToBarEvent),
    };
    const indexByEventId = new Map<BarEvent["id"], number>(
      barItem.events.map((e, i) => [e.id, i]),
    );

    return (
      <HoverCard
        openDelay={0}
        closeDelay={0}
        open={open}
        onOpenChange={(next) => {
          if (next) onRequestOpen(thisDayKey);
          else onRequestClose();
        }}
      >
        <HoverCardTrigger asChild>
          <button
            type="button"
            ref={forwardedRef as RefObject<HTMLButtonElement>}
            data-day={thisDayKey}
            data-day-state="interactive"
            aria-pressed={open}
            className={dayClass}
            onClick={() => onRequestOpen(thisDayKey)}
            onMouseEnter={() => onRequestOpen(thisDayKey)}
            onMouseLeave={onRequestClose}
            onFocus={() => onRequestOpen(thisDayKey)}
            onBlur={onRequestClose}
            onKeyDown={(e) => {
              if (e.key === "Escape") onRequestClose();
            }}
          >
            {format(date, "d")}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="center"
          className="w-auto min-w-40 p-0"
          onMouseEnter={() => onRequestOpen(thisDayKey)}
          onMouseLeave={onRequestClose}
        >
          <StatusBarCard
            item={barItem}
            renderEvent={(event) => {
              const fn = renderMarkerRowRef.current;
              if (!fn) return undefined;
              const idx = indexByEventId.get(event.id) ?? 0;
              return (
                <div key={`${event.id}-${event.type}`}>
                  {fn(dayMarkers[idx])}
                </div>
              );
            }}
          />
        </HoverCardContent>
      </HoverCard>
    );
  },
);

function markerToBarEvent(m: StatusCalendarMarker): BarEvent {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    from: m.from ?? null,
    to: m.to ?? null,
    isAggregated: m.isAggregated,
  };
}

export interface StatusCalendarSkeletonProps {
  /** Title shown in the header chrome; falls back to "Calendar" if omitted. */
  title?: ReactNode;
  className?: string;
}

/**
 * Loading-state placeholder that mirrors `<StatusCalendar>`'s chrome (header
 * + weekday strip + 6×7 grid). Render this while the data feeding the calendar
 * is in flight; swap to `<StatusCalendar>` once `markers` are ready.
 */
export function StatusCalendarSkeleton({
  title,
  className,
}: StatusCalendarSkeletonProps) {
  const labels = useStatusBlocksLabels();
  return (
    <div
      data-slot="status-calendar-skeleton"
      className={cn(
        "flex flex-col rounded-lg border bg-card text-card-foreground",
        className,
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="font-medium text-sm">
          {title ?? labels.calendarTitle}
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </header>
      <div className="border-t">
        <div className="flex w-full border-b">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`weekday-${i}`}
              className="flex flex-1 justify-center py-1.5"
            >
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={`row-${row}`} className="flex w-full">
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={`cell-${row}-${col}`}
                className="flex h-12 flex-1 items-center justify-center border-r border-b last:border-r-0"
              >
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
