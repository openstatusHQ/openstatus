"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useMediaQuery } from "@openstatus/ui/hooks/use-media-query";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceStrict } from "date-fns";
import { useCallback, useEffect, useRef, useState, forwardRef } from "react";
import {
  statusColors,
  formatDateRange,
  requestStatusLabels,
} from "@openstatus/ui/components/blocks/status.utils";
import type {
  StatusBarData,
  StatusEventType,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";

interface StatusBarProps {
  data: StatusBarData[];
  renderCard?: (
    data: StatusBarData["card"][number],
    index: number,
  ) => React.ReactNode;
  renderBar?: (
    data: StatusBarData["bar"][number],
    index: number,
  ) => React.ReactNode;
  renderEvent?: (
    data: StatusBarData["events"][number],
    index: number,
  ) => React.ReactNode;
}

interface UseStatusBarProps {
  dataLength: number;
  isTouch: boolean;
}

type InteractionType = "pin" | "hover" | "focus" | null;

/**
 * useStatusBar - Headless hook for managing status bar interactions and keyboard navigation
 *
 * This hook provides the core logic for StatusBar interactions, implementing a
 * headless UI pattern that separates state management from presentation. It handles:
 *
 * **Interaction Modes**:
 * - **hover**: Desktop hover state (shows card on mouse hover, auto-hides on leave)
 * - **pin**: Pinned state (click to pin card open, click again or Esc to close)
 * - **focus**: Keyboard focus state (shows card while focused, hides on blur)
 *
 * **Keyboard Navigation**:
 * - **Arrow Left/Right**: Navigate between bars in the same timeline
 * - **Arrow Up/Down**: Navigate between timelines (different monitors)
 * - **Enter/Space**: Pin/unpin the active bar
 * - **Escape**: Close pinned card and remove focus
 *
 * **Touch Device Support**:
 * - Disables hover state on touch devices (detected via `(hover: none)` media query)
 * - Click interaction works on both touch and non-touch devices
 *
 * **Outside Click Handling**:
 * - Automatically closes pinned cards when clicking outside the component
 *
 * @param dataLength - Total number of bars in the timeline
 * @param isTouch - Whether the device supports touch (no hover capability)
 *
 * @returns Hook state and handlers:
 * - `activeIndex`: Currently active bar index (null if none)
 * - `isOpen`: Whether a card is currently displayed
 * - `interactionType`: Current interaction mode ("pin" | "hover" | "focus" | null)
 * - `containerRef`: Ref for the status bar container (for outside click detection)
 * - `handlers`: Event handler functions for mouse/keyboard/focus interactions
 * - `setButtonRef`: Function to register bar element refs (for keyboard navigation)
 *
 * @example
 * ```tsx
 * function CustomStatusBar({ data }) {
 *   const isTouch = useMediaQuery("(hover: none)");
 *   const { activeIndex, handlers, setButtonRef, containerRef } = useStatusBar({
 *     dataLength: data.length,
 *     isTouch,
 *   });
 *
 *   return (
 *     <div ref={containerRef} role="toolbar">
 *       {data.map((item, index) => (
 *         <button
 *           key={index}
 *           ref={(el) => setButtonRef(index, el)}
 *           onClick={() => handlers.onClick(index)}
 *           onFocus={() => handlers.onFocus(index)}
 *           onKeyDown={(e) => handlers.onKeyDown(e, index)}
 *         >
 *           {// Custom bar rendering}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see StatusBar - For the complete implementation using this hook
 */
function useStatusBar({ dataLength, isTouch }: UseStatusBarProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>(null);
  const buttonRefs = useRef<(HTMLElement | null)[]>([]);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handle clicks outside to close pinned card
  useEffect(() => {
    if (interactionType !== "pin" || activeIndex === null) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setActiveIndex(null);
        setInteractionType(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [interactionType, activeIndex]);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (index: number) => {
      clearHoverTimeout();
      setActiveIndex((prev) => {
        if (prev === index) {
          setInteractionType(null);
          return null;
        }
        setInteractionType("pin");
        return index;
      });
    },
    [clearHoverTimeout],
  );

  const handleHoverStart = useCallback(
    (index: number) => {
      // On touch devices, don't show hover state
      if (isTouch) return;

      clearHoverTimeout();
      setActiveIndex(index);
      setInteractionType("hover");
    },
    [isTouch, clearHoverTimeout],
  );

  const handleHoverEnd = useCallback(() => {
    // Only clear hover state, not pinned or focused
    if (interactionType !== "hover") return;

    hoverTimeoutRef.current = setTimeout(() => {
      setActiveIndex(null);
      setInteractionType(null);
    }, 100);
  }, [interactionType]);

  const handleFocus = useCallback((index: number) => {
    setActiveIndex(index);
    setInteractionType("focus");
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Only clear if not moving to another bar
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToAnotherBar =
      relatedTarget &&
      relatedTarget.closest('[role="toolbar"]') === containerRef.current &&
      relatedTarget.getAttribute("role") === "button";

    if (!isMovingToAnotherBar) {
      setActiveIndex(null);
      setInteractionType(null);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setActiveIndex(null);
          setInteractionType(null);
          clearHoverTimeout();
          buttonRefs.current[currentIndex]?.blur();
          break;

        case "ArrowLeft":
          e.preventDefault();
          {
            const newIndex =
              currentIndex > 0 ? currentIndex - 1 : dataLength - 1;
            buttonRefs.current[newIndex]?.focus();
          }
          break;

        case "ArrowRight":
          e.preventDefault();
          {
            const newIndex =
              currentIndex < dataLength - 1 ? currentIndex + 1 : 0;
            buttonRefs.current[newIndex]?.focus();
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          {
            // Navigate to previous monitor's status bar
            const prevMonitor = containerRef.current?.closest(
              '[data-slot="status-monitor"]',
            )?.previousElementSibling;
            if (prevMonitor) {
              const prevBar = prevMonitor.querySelector('[role="toolbar"]');
              if (prevBar) {
                const prevButtons = prevBar.querySelectorAll('[role="button"]');
                const targetButton = prevButtons[currentIndex] as HTMLElement;
                targetButton?.focus();
              }
            }
          }
          break;

        case "ArrowDown":
          e.preventDefault();
          {
            // Navigate to next monitor's status bar
            const nextMonitor = containerRef.current?.closest(
              '[data-slot="status-monitor"]',
            )?.nextElementSibling;
            if (nextMonitor) {
              const nextBar = nextMonitor.querySelector('[role="toolbar"]');
              if (nextBar) {
                const nextButtons = nextBar.querySelectorAll('[role="button"]');
                const targetButton = nextButtons[currentIndex] as HTMLElement;
                targetButton?.focus();
              }
            }
          }
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          handleClick(currentIndex);
          break;
      }
    },
    [dataLength, clearHoverTimeout, handleClick],
  );

  const setButtonRef = useCallback((index: number, el: HTMLElement | null) => {
    buttonRefs.current[index] = el;
  }, []);

  return {
    activeIndex,
    isOpen: activeIndex !== null,
    interactionType,
    containerRef,
    handlers: {
      onClick: handleClick,
      onHoverStart: handleHoverStart,
      onHoverEnd: handleHoverEnd,
      onHoverCardEnter: clearHoverTimeout,
      onHoverCardLeave: () => {
        setActiveIndex(null);
        setInteractionType(null);
      },
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
    setButtonRef,
  };
}

/**
 * StatusBar - Interactive uptime timeline with keyboard navigation and hover cards
 *
 * Displays a horizontal timeline of status bars, where each bar represents a day's
 * status with color-coded segments. Interactive hover cards show detailed status
 * information, events, and incidents for each day.
 *
 * **Key Features**:
 * - **Visual Timeline**: Vertical bars with color-coded segments showing status over time
 * - **Interactive Cards**: Hover/click to see detailed breakdowns and events
 * - **Keyboard Navigation**: Full keyboard support with arrow keys, Enter, and Escape
 * - **Touch Support**: Optimized interactions for touch devices
 * - **Customizable Rendering**: Override default renderers for bars, cards, and events
 * - **Accessibility**: ARIA roles, labels, and keyboard navigation
 *
 * **Interaction Modes**:
 * - Desktop: Hover to preview, click to pin, Esc to close
 * - Touch: Tap to toggle card open/closed
 * - Keyboard: Arrow keys to navigate, Enter/Space to pin, Esc to close
 *
 * **Keyboard Navigation**:
 * - **Left/Right Arrows**: Move between bars in the timeline
 * - **Up/Down Arrows**: Navigate between different monitor timelines
 * - **Enter/Space**: Pin or unpin the active card
 * - **Escape**: Close card and remove focus
 *
 * **Data Structure**:
 * Each data item represents a day and contains:
 * - `day`: Date string
 * - `bar`: Array of segments with status and height percentage
 * - `card`: Array of status breakdowns to display in hover card
 * - `events`: Array of incidents/maintenance events for that day
 *
 * @param data - Array of status bar data items (one per day)
 * @param renderCard - Optional custom renderer for card content items
 * @param renderBar - Optional custom renderer for bar segments
 * @param renderEvent - Optional custom renderer for event badges
 *
 * @example
 * // Basic usage with default rendering
 * ```tsx
 * const uptimeData = [
 *   {
 *     day: "2024-01-15",
 *     bar: [{ status: "success", height: 100 }],
 *     card: [{ status: "success", value: "100%" }],
 *     events: []
 *   },
 *   {
 *     day: "2024-01-16",
 *     bar: [
 *       { status: "success", height: 80 },
 *       { status: "error", height: 20 }
 *     ],
 *     card: [
 *       { status: "success", value: "80%" },
 *       { status: "error", value: "20%" }
 *     ],
 *     events: [
 *       {
 *         id: "inc-1",
 *         type: "incident",
 *         name: "API Downtime",
 *         from: new Date("2024-01-16T10:00:00Z"),
 *         to: new Date("2024-01-16T10:30:00Z")
 *       }
 *     ]
 *   }
 * ];
 *
 * <StatusBar data={uptimeData} />
 * ```
 *
 * @example
 * // With custom bar renderer
 * ```tsx
 * <StatusBar
 *   data={uptimeData}
 *   renderBar={(segment, index) => (
 *     <div
 *       key={index}
 *       className="w-full transition-all"
 *       style={{
 *         height: `${segment.height}%`,
 *         background: `linear-gradient(to top, ${statusColors[segment.status]}, transparent)`
 *       }}
 *     />
 *   )}
 * />
 * ```
 *
 * @example
 * // With custom event renderer
 * ```tsx
 * <StatusBar
 *   data={uptimeData}
 *   renderEvent={(event, index) => (
 *     <Link key={index} href={`/incidents/${event.id}`}>
 *       <div className="text-sm hover:underline">
 *         {event.name}
 *       </div>
 *     </Link>
 *   )}
 * />
 * ```
 *
 * @see useStatusBar - For the headless hook powering the interactions
 * @see StatusBarSkeleton - For loading state
 * @see StatusBarEvent - For event badge rendering
 */
export function StatusBar({
  data,
  renderCard,
  renderBar,
  renderEvent,
}: StatusBarProps) {
  const isTouch = useMediaQuery("(hover: none)");
  const { activeIndex, interactionType, containerRef, handlers, setButtonRef } =
    useStatusBar({
      dataLength: data.length,
      isTouch,
    });

  return (
    <div
      ref={containerRef}
      className="flex h-[50px] w-full items-end"
      role="toolbar"
      aria-label="Status tracker"
    >
      {data.map((item, index) => {
        const isActive = activeIndex === index;
        const isPinned = isActive && interactionType === "pin";

        return (
          <StatusBarItem
            key={item.day}
            ref={(el) => setButtonRef(index, el)}
            index={index}
            item={item}
            isActive={isActive}
            isPinned={isPinned}
            isTouch={isTouch}
            isLastItem={index === data.length - 1}
            handlers={handlers}
            renderCard={renderCard}
            renderBar={renderBar}
            renderEvent={renderEvent}
          />
        );
      })}
    </div>
  );
}

interface StatusBarItemProps {
  index: number;
  item: StatusBarData;
  isActive: boolean;
  isPinned: boolean;
  isTouch: boolean;
  isLastItem: boolean;
  handlers: ReturnType<typeof useStatusBar>["handlers"];
  renderCard?: StatusBarProps["renderCard"];
  renderBar?: StatusBarProps["renderBar"];
  renderEvent?: StatusBarProps["renderEvent"];
}

const StatusBarItem = forwardRef<HTMLDivElement, StatusBarItemProps>(
  (
    {
      index,
      item,
      isActive,
      isPinned,
      isTouch,
      isLastItem,
      handlers,
      renderCard,
      renderBar,
      renderEvent,
    },
    ref,
  ) => {
    return (
      <HoverCard openDelay={0} closeDelay={0} open={isActive}>
        <HoverCardTrigger asChild>
          <div
            ref={ref}
            className={cn(
              "group relative mx-px flex h-full w-full cursor-pointer flex-col rounded-full outline-none first:ml-0 last:mr-0 hover:opacity-80 focus-visible:opacity-80 focus-visible:ring-[2px] focus-visible:ring-ring/50 data-[aria-pressed=true]:opacity-80",
              "overflow-hidden rounded-full",
            )}
            onClick={() => handlers.onClick(index)}
            onFocus={() => handlers.onFocus(index)}
            onBlur={handlers.onBlur}
            onMouseEnter={() => handlers.onHoverStart(index)}
            onMouseLeave={handlers.onHoverEnd}
            onKeyDown={(e) => handlers.onKeyDown(e, index)}
            tabIndex={isLastItem && !isActive ? 0 : isActive ? 0 : -1}
            role="button"
            aria-label={`Day ${index + 1} status`}
            aria-pressed={isPinned}
            aria-expanded={isActive}
          >
            {/* Render bar segments */}
            {item.bar.map((segment, segmentIndex) => {
              if (renderBar) {
                return renderBar(segment, segmentIndex);
              }
              return (
                <div
                  key={`${item.day}-${segment.status}-${segmentIndex}`}
                  className={cn("w-full transition-all", {
                    "rounded-t-full": segmentIndex === 0,
                    "rounded-b-full": segmentIndex === item.bar.length - 1,
                  })}
                  style={{
                    height: `${segment.height}%`,
                    backgroundColor: statusColors[segment.status],
                  }}
                />
              );
            })}
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="center"
          className="w-auto min-w-40 p-0"
          onMouseEnter={handlers.onHoverCardEnter}
          onMouseLeave={handlers.onHoverCardLeave}
          onPointerDownOutside={(e) => {
            // Prevent closing on touch devices when clicking the card
            if (isTouch) {
              e.preventDefault();
            }
          }}
        >
          <StatusBarCard
            item={item}
            isPinned={isPinned}
            isTouch={isTouch}
            renderCard={renderCard}
            renderEvent={renderEvent}
          />
        </HoverCardContent>
      </HoverCard>
    );
  },
);

StatusBarItem.displayName = "StatusBarItem";

interface StatusBarCardProps {
  item: StatusBarData;
  isPinned: boolean;
  isTouch: boolean;
  renderCard?: StatusBarProps["renderCard"];
  renderEvent?: StatusBarProps["renderEvent"];
}

/**
 * StatusBarCard - Internal hover card content component
 *
 * Displays detailed status information for a single day in a hover card, including:
 * - Date header
 * - Status breakdown percentages
 * - Events/incidents for that day
 * - Pin/unpin instructions (when pinned on desktop)
 *
 * The card automatically formats the date and renders status items and events
 * using either custom renderers or default implementations.
 *
 * @param item - The status bar data for this day
 * @param isPinned - Whether the card is currently pinned open
 * @param isTouch - Whether the device supports touch
 * @param renderCard - Optional custom renderer for status items
 * @param renderEvent - Optional custom renderer for events
 */
function StatusBarCard({
  item,
  isPinned,
  isTouch,
  renderCard,
  renderEvent,
}: StatusBarCardProps) {
  return (
    <div>
      <div className="p-2 text-xs">
        {new Date(item.day).toLocaleDateString("default", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </div>
      <Separator />
      <div className="space-y-1 p-2 text-sm">
        {item.card.map((cardItem, cardIndex) => {
          if (renderCard) {
            return renderCard(cardItem, cardIndex);
          }
          return (
            <StatusBarContent
              key={`${item.day}-card-${cardIndex}`}
              status={cardItem.status}
              value={cardItem.value}
            />
          );
        })}
      </div>
      {item.events.length > 0 && (
        <>
          <Separator />
          <div className="p-2">
            {item.events.map((event, eventIndex) => {
              if (renderEvent) {
                return renderEvent(event, eventIndex);
              }
              return (
                <StatusBarEvent
                  key={`${event.id}-${event.type}`}
                  type={event.type}
                  name={event.name}
                  from={event.from}
                  to={event.to}
                />
              );
            })}
          </div>
        </>
      )}
      {isPinned && !isTouch && (
        <>
          <Separator />
          <div className="flex cursor-pointer items-center p-2 text-muted-foreground text-xs">
            <span>Click again to unpin</span>
            <kbd className="ml-auto inline-flex h-5 max-h-5 min-w-5 items-center justify-center rounded border border-input bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              Esc
            </kbd>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * StatusBarSkeleton - Loading skeleton for StatusBar
 *
 * Displays a skeleton loader matching the height and width of a StatusBar,
 * used while status data is being fetched.
 *
 * @example
 * ```tsx
 * {isLoading ? (
 *   <StatusBarSkeleton />
 * ) : (
 *   <StatusBar data={uptimeData} />
 * )}
 * ```
 *
 * @see StatusBar - For the actual status bar component
 */
export function StatusBarSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("h-[50px] w-full rounded-none bg-muted", className)}
      {...props}
    />
  );
}

/**
 * StatusBarContent - Internal component for status breakdown rows
 *
 * Displays a single status item in the hover card with a colored indicator,
 * status label, and percentage value. Used by StatusBarCard to show the
 * breakdown of statuses for a day.
 *
 * @param status - The status type (success, degraded, error, info, empty)
 * @param value - The percentage or count value to display
 *
 * @example
 * ```tsx
 * <StatusBarContent status="success" value="95.2%" />
 * <StatusBarContent status="error" value="4.8%" />
 * ```
 */
function StatusBarContent({
  status,
  value,
}: {
  status: StatusType;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-sm"
          style={{
            backgroundColor: statusColors[status],
          }}
        />
        <div className="text-sm">{requestStatusLabels[status]}</div>
      </div>
      <div className="ml-auto font-mono text-muted-foreground text-xs tracking-tight">
        {value}
      </div>
    </div>
  );
}

/**
 * StatusBarEvent - Event badge for incidents and maintenance
 *
 * Displays an event within a status bar hover card, showing:
 * - Color-coded indicator (red for incidents, yellow for reports, blue for maintenance)
 * - Event name with truncation for long names
 * - Date range (formatted as "Since", "Until", or "Jan 15 - Jan 16")
 * - Duration (formatted as "2 hours", "ongoing", or "across 3 days" for multiple incidents)
 *
 * The component automatically determines the status color based on the event type:
 * - incident → error (red)
 * - report → degraded (yellow)
 * - maintenance → info (blue)
 *
 * Returns null if no start date is provided.
 *
 * @param name - Event name or title
 * @param from - Event start date
 * @param to - Event end date (null for ongoing events)
 * @param type - Event type ("incident", "report", or "maintenance")
 *
 * @example
 * ```tsx
 * <StatusBarEvent
 *   type="incident"
 *   name="API Downtime"
 *   from={new Date("2024-01-15T10:00:00Z")}
 *   to={new Date("2024-01-15T10:30:00Z")}
 * />
 * // Displays: [●] API Downtime
 * //           Jan 15, 10:00 AM - 10:30 AM  30 minutes
 * ```
 *
 * @example
 * ```tsx
 * // Ongoing incident
 * <StatusBarEvent
 *   type="incident"
 *   name="Database connectivity issues"
 *   from={new Date()}
 *   to={null}
 * />
 * // Displays: [●] Database connectivity issues
 * //           Since Jan 15, 2:30 PM  ongoing
 * ```
 *
 * @see StatusBarCard - For the card that contains event badges
 * @see formatDateRange - For date range formatting
 */
export function StatusBarEvent({
  name,
  from,
  to,
  type,
}: {
  name: string;
  from?: Date | null;
  to?: Date | null;
  type: StatusEventType;
}) {
  if (!from) return null;

  const status =
    type === "incident" ? "error" : type === "report" ? "degraded" : "info";

  return (
    <div className="group relative text-sm">
      {/* NOTE: this is to make the text truncate based on the width of the sibling element */}
      {/* REMINDER: height needs to be equal the text height */}
      <div className="h-4 w-full" />
      <div className="absolute inset-0 text-muted-foreground hover:text-foreground">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{
              backgroundColor: statusColors[status],
            }}
          />
          <div className="truncate">{name}</div>
        </div>
      </div>
      <div className="mt-1 text-muted-foreground text-xs">
        {formatDateRange(from, to ?? undefined)}{" "}
        <span className="ml-1.5 font-mono text-muted-foreground/70">
          {formatDuration({ from, to, name, type })}
        </span>
      </div>
    </div>
  );
}

/**
 * formatDuration - Internal helper for formatting event durations
 *
 * Formats the duration of an event based on start/end dates and event name:
 * - No start date: returns null
 * - No end date: returns "ongoing"
 * - Multiple incidents (detected by "Downtime (" in name): returns "across {duration}"
 * - Zero seconds duration: returns null (hides duration)
 * - Otherwise: returns formatted duration (e.g., "2 hours", "3 days")
 *
 * @param from - Event start date
 * @param to - Event end date
 * @param name - Event name (used to detect multiple incident aggregations)
 * @returns Formatted duration string or null
 */
const formatDuration = ({
  from,
  to,
  name,
}: React.ComponentProps<typeof StatusBarEvent>) => {
  if (!from) return null;
  if (!to) return "ongoing";
  const duration = formatDistanceStrict(from, to);
  const isMultipleIncidents = name.includes("Downtime (");
  if (isMultipleIncidents) return `across ${duration}`;
  if (duration === "0 seconds") return null;
  return duration;
};
