"use client";

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
import { Separator } from "@openstatus/ui/components/ui/separator";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useMediaQuery } from "@openstatus/ui/hooks/use-media-query";
import { cn } from "@openstatus/ui/lib/utils";
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
  type FocusEvent,
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

type BarEvent = StatusBarData["events"][number];

export interface StatusCalendarMarker {
  id: string | number;
  /** Day this marker belongs to, in the viewer's local timezone. */
  date: Date;
  /** Drives the day cell's tinted-fill color (worst-severity wins per day). */
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
  /**
   * Treat the calendar as status history: render days after the latest event
   * (or today, whichever is later) as disabled. Days up to and including that
   * boundary — including scheduled future events — stay interactive. Forward
   * navigation is still capped at the latest event's month. Defaults to false.
   */
  disableFuture?: boolean;
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
  /**
   * Restrict which event types drive the calendar (day fills, hover cards, and
   * the forward-navigation cap). Markers of any other type are ignored. When
   * omitted, all event types are shown.
   */
  eventTypes?: StatusEventType[];
}

const SEVERITY_RANK: Record<StatusCalendarMarker["status"], number> = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
};

// Hover deepens the same tint rather than swapping to the neutral accent, so
// the severity signal survives the hover state.
const SEVERITY_FILL: Record<StatusCalendarMarker["status"], string> = {
  error: "bg-destructive/10 hover:bg-destructive/20 text-destructive",
  degraded: "bg-warning/10 hover:bg-warning/20 text-warning",
  info: "bg-info/10 hover:bg-info/20 text-info",
  success: "bg-success/10 hover:bg-success/20 text-success",
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
  disableFuture = false,
  className,
  title,
  locale,
  renderMarkerRow,
  eventTypes,
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

  // Drop markers whose type the caller opted out of before anything else reads
  // them, so excluded types affect neither the fills, the cards, nor nav.
  const visibleMarkers = useMemo(() => {
    if (!eventTypes) return markers;
    const allowed = new Set(eventTypes);
    return markers.filter((m) => allowed.has(m.type));
  }, [markers, eventTypes]);

  const markersByDay = useMemo(() => {
    const map = new Map<string, StatusCalendarMarker[]>();
    for (const marker of visibleMarkers) {
      const key = dayKey(marker.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(marker);
      else map.set(key, [marker]);
    }
    return map;
  }, [visibleMarkers]);

  // Cap forward navigation at the latest month that has a marker (or the
  // current month, whichever is later). Prevents browsing into empty future
  // months when no maintenance/event is scheduled.
  const maxMonth = useMemo(() => {
    const today = startOfMonth(new Date());
    return visibleMarkers.reduce((acc, m) => {
      const mm = startOfMonth(m.date);
      return mm.getTime() > acc.getTime() ? mm : acc;
    }, today);
  }, [visibleMarkers]);
  const canGoNext = currentMonth.getTime() < maxMonth.getTime();

  // Status-history cutoff: disable days strictly after the latest event (or
  // today, whichever is later) so the empty trailing future is blocked while
  // scheduled future events stay reachable. Null = no blocking.
  const maxDay = useMemo(() => {
    if (!disableFuture) return null;
    const today = startOfDay(new Date());
    return visibleMarkers.reduce((acc, m) => {
      const d = startOfDay(m.date);
      return d.getTime() > acc.getTime() ? d : acc;
    }, today);
  }, [visibleMarkers, disableFuture]);

  // Open state lives at the parent so the popover survives DayPicker remounts.
  // Interaction model mirrors `status-bar.tsx` (hover on non-touch, tap pins).
  const isTouch = useMediaQuery("(hover: none)");
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  // Via ref, not a `Day` dep: keeps `Day` identity stable so cells don't remount
  // every hover. CalendarDay re-renders top-down on setActiveDayKey regardless.
  const activeDayKeyRef = useRef(activeDayKey);
  useEffect(() => {
    activeDayKeyRef.current = activeDayKey;
  }, [activeDayKey]);
  const [interaction, setInteraction] = useState<
    "hover" | "pin" | "focus" | null
  >(null);
  const interactionRef = useRef(interaction);
  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);

  const closeTimerRef = useRef<number | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const close = useCallback(() => {
    cancelClose();
    setActiveDayKey(null);
    setInteraction(null);
  }, [cancelClose]);

  // Tap/click pins the card; tapping the pinned day again closes it. This is
  // the only open path on touch — Radix HoverCard ignores touch pointers. The
  // `interactionRef` lags a tap's focus event, so a focus-then-click on the
  // same day still reads "pin" and toggles closed.
  const handleClick = useCallback(
    (key: string) => {
      cancelClose();
      setActiveDayKey((prev) => {
        if (prev === key && interactionRef.current === "pin") {
          setInteraction(null);
          return null;
        }
        setInteraction("pin");
        return key;
      });
    },
    [cancelClose],
  );
  const handleHoverStart = useCallback(
    (key: string) => {
      if (isTouch) return;
      cancelClose();
      setActiveDayKey(key);
      setInteraction("hover");
    },
    [isTouch, cancelClose],
  );
  const handleHoverEnd = useCallback(() => {
    if (interactionRef.current !== "hover") return;
    closeTimerRef.current = window.setTimeout(() => {
      setActiveDayKey(null);
      setInteraction(null);
    }, 100);
  }, []);
  const handleFocus = useCallback((key: string) => {
    setActiveDayKey(key);
    setInteraction("focus");
  }, []);
  const handleBlur = useCallback(
    (e: FocusEvent) => {
      const next = e.relatedTarget as Element | null;
      // Focus moving into the card (e.g. an event link) shouldn't close it.
      if (next?.closest('[data-slot="status-bar-card"]')) return;
      close();
    },
    [close],
  );

  // Outside pointerdown closes the pinned card. Radix's own dismiss is
  // suppressed on touch (see HoverCardContent) and the card is portaled out of
  // `containerRef`, so we also keep clicks that land inside the card itself.
  useEffect(() => {
    if (activeDayKey === null) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (containerRef.current?.contains(target)) return;
      if (target?.closest('[data-slot="status-bar-card"]')) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [activeDayKey, close]);

  const renderMarkerRowRef = useRef(renderMarkerRow);
  useEffect(() => {
    renderMarkerRowRef.current = renderMarkerRow;
  }, [renderMarkerRow]);

  const Day = useCallback(
    (dayProps: DayProps) => (
      <CalendarDay
        {...dayProps}
        markersByDay={markersByDay}
        activeDayKeyRef={activeDayKeyRef}
        isTouch={isTouch}
        onClickDay={handleClick}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
        onHoverCardEnter={cancelClose}
        onHoverCardLeave={close}
        onFocusDay={handleFocus}
        onBlurDay={handleBlur}
        onClose={close}
        renderMarkerRowRef={renderMarkerRowRef}
        maxDay={maxDay}
      />
    ),
    [
      markersByDay,
      isTouch,
      handleClick,
      handleHoverStart,
      handleHoverEnd,
      cancelClose,
      close,
      handleFocus,
      handleBlur,
      maxDay,
    ],
  );

  const dayPickerComponents = useMemo(() => ({ Day }), [Day]);

  return (
    <div
      ref={containerRef}
      data-slot="status-calendar"
      className={cn(
        "bg-card text-card-foreground flex flex-col rounded-lg border",
        className,
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="text-sm font-medium">{resolvedTitle}</div>
        <div className="text-muted-foreground ml-auto flex items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Previous month"
            onClick={() => setMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-foreground text-center font-mono font-medium tabular-nums">
            {formatMonthYear(currentMonth)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Next month"
            disabled={!canGoNext}
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
              "flex-1 text-muted-foreground font-mono font-normal text-[0.7rem] uppercase tracking-wide py-1.5 border-r last:border-r-0",
            row: "flex w-full border-b last:border-b-0",
            cell: "flex-1 relative p-0 text-center text-sm border-r last:border-r-0 focus-within:relative focus-within:z-20",
            day: cn(
              "text-foreground/80 inline-flex h-12 w-full items-center justify-center text-sm font-normal transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
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
  activeDayKeyRef: RefObject<string | null>;
  isTouch: boolean;
  onClickDay: (key: string) => void;
  onHoverStart: (key: string) => void;
  onHoverEnd: () => void;
  onHoverCardEnter: () => void;
  onHoverCardLeave: () => void;
  onFocusDay: (key: string) => void;
  onBlurDay: (e: FocusEvent) => void;
  onClose: () => void;
  renderMarkerRowRef: RefObject<
    ((marker: StatusCalendarMarker) => ReactNode) | undefined
  >;
  /** Days strictly after this are disabled; null disables blocking entirely. */
  maxDay: Date | null;
}

const CalendarDay = forwardRef<HTMLElement, CalendarDayProps>(
  function CalendarDay(
    {
      date,
      displayMonth,
      markersByDay,
      activeDayKeyRef,
      isTouch,
      onClickDay,
      onHoverStart,
      onHoverEnd,
      onHoverCardEnter,
      onHoverCardLeave,
      onFocusDay,
      onBlurDay,
      onClose,
      renderMarkerRowRef,
      maxDay,
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
      return (
        <div data-day-state="outside" className="bg-muted/30 h-12 w-full" />
      );
    }

    // Past the status-history cutoff: render a dimmed, non-interactive cell.
    const isBlocked =
      maxDay !== null && startOfDay(date).getTime() > maxDay.getTime();
    if (isBlocked) {
      return (
        <div
          ref={forwardedRef as RefObject<HTMLDivElement>}
          data-day={thisDayKey}
          data-day-state="disabled"
          aria-disabled
          tabIndex={-1}
          className="text-muted-foreground/40 inline-flex h-12 w-full items-center justify-center font-mono text-sm"
        >
          {format(date, "d")}
        </div>
      );
    }

    const isToday = isSameDay(date, new Date());
    const dayMarkers = markersByDay.get(thisDayKey) ?? [];
    const severity =
      dayMarkers.length > 0 ? worstSeverity(dayMarkers) : undefined;
    const open = activeDayKeyRef.current === thisDayKey;

    const hasMarkers = dayMarkers.length > 0;
    // Tinted-field: severity days get a soft fill that owns the hover state,
    // empty days fall back to the neutral accent hover.
    const dayClass = cn(
      "text-foreground/80 inline-flex h-12 w-full items-center justify-center font-mono text-sm font-normal transition-colors",
      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
      isToday && "text-foreground font-semibold",
      severity
        ? SEVERITY_FILL[severity]
        : "hover:bg-accent hover:text-accent-foreground",
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
      // No `onOpenChange`: open state is fully controlled by our handlers (see
      // parent), matching `status-bar.tsx`. Radix's hover/dismiss listeners fire
      // into a no-op, so they can't fight the pin/toggle model.
      <HoverCard openDelay={0} closeDelay={0} open={open}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            ref={forwardedRef as RefObject<HTMLButtonElement>}
            data-day={thisDayKey}
            data-day-state="interactive"
            aria-pressed={open}
            className={dayClass}
            onClick={() => onClickDay(thisDayKey)}
            onMouseEnter={() => onHoverStart(thisDayKey)}
            onMouseLeave={onHoverEnd}
            onFocus={() => onFocusDay(thisDayKey)}
            onBlur={onBlurDay}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          >
            {format(date, "d")}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="center"
          className="w-auto min-w-40 p-0"
          onMouseEnter={onHoverCardEnter}
          onMouseLeave={onHoverCardLeave}
          // On touch, the opening tap's emulated pointer sequence would trip
          // Radix's dismiss-on-outside and close the card immediately. Suppress
          // it here; the parent's document listener handles real outside taps.
          onPointerDownOutside={(e) => {
            if (isTouch) e.preventDefault();
          }}
        >
          <StatusBarCard
            item={barItem}
            renderEvent={(event, eventIndex) => {
              const fn = renderMarkerRowRef.current;
              if (!fn) return undefined;
              const idx = indexByEventId.get(event.id) ?? 0;
              return (
                <div key={`${event.id}-${event.type}`}>
                  {eventIndex > 0 && (
                    <Separator className="-mx-2 my-2 data-[orientation=horizontal]:w-auto" />
                  )}
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

/** Loading placeholder mirroring `<StatusCalendar>`'s chrome (header + 6×7 grid). */
export function StatusCalendarSkeleton({
  title,
  className,
}: StatusCalendarSkeletonProps) {
  const labels = useStatusBlocksLabels();
  return (
    <div
      data-slot="status-calendar-skeleton"
      className={cn(
        "bg-card text-card-foreground flex flex-col rounded-lg border",
        className,
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="text-sm font-medium">
          {title ?? labels.calendarTitle}
        </div>
        <div className="ml-auto flex items-center gap-1">
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
              className="flex flex-1 justify-center border-r py-1.5 last:border-r-0"
            >
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div
            key={`row-${row}`}
            className="flex w-full border-b last:border-b-0"
          >
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={`cell-${row}-${col}`}
                className="flex h-12 flex-1 items-center justify-center border-r last:border-r-0"
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
