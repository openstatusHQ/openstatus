"use client";

import { Kbd } from "@/components/common/kbd";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { formatDateRange } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceStrict } from "date-fns";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { requests } from "./messages";
import { chartConfig } from "./utils";

type UptimeData = NonNullable<
  RouterOutputs["statusPage"]["getUptime"]
>[number]["data"];

// TODO: keyboard arrow navigation
// FIXME: on small screens, avoid pinned state
// TODO: only on real mobile devices, use click events
// TODO: improve status reports -> add duration and time
// TODO: support headless mode -> both card and bar type share only maintenance or degraded mode
// TODO: support status page logo + onClick to homepage
// TODO: widget type -> current status only | with status history

export function StatusTracker({ data }: { data: UptimeData }) {
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTouch = useMediaQuery("(hover: none)");
  const prefix = usePathnamePrefix();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        pinnedIndex !== null &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setPinnedIndex(null);
      }
    };

    if (pinnedIndex !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () =>
        document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [pinnedIndex]);

  useEffect(() => {
    if (focusedIndex !== null && containerRef.current) {
      const buttons = containerRef.current.querySelectorAll('[role="button"]');
      const targetButton = buttons[focusedIndex] as HTMLElement;
      if (targetButton) {
        targetButton.focus();
      }
    }
  }, [focusedIndex]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setPinnedIndex(null);
      setFocusedIndex(null);
      setHoveredIndex(null);

      if (focusedIndex !== null) {
        const buttons =
          containerRef.current?.querySelectorAll('[role="button"]');
        const button = buttons?.[focusedIndex] as HTMLElement;
        if (button) {
          button.blur();
        }
      }

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      return;
    }

    if (focusedIndex !== null) {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev !== null && prev > 0 ? prev - 1 : data.length - 1,
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev !== null && prev < data.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          const prevMonitor = containerRef.current?.closest(
            '[data-slot="status-monitor"]',
          )?.previousElementSibling;
          if (prevMonitor) {
            const prevTracker = prevMonitor.querySelector('[role="toolbar"]');
            if (prevTracker) {
              const buttons = prevTracker.querySelectorAll('[role="button"]');
              const button = buttons?.[focusedIndex] as HTMLElement;
              if (button) {
                button.focus();
              }
            }
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          const nextMonitor = containerRef.current?.closest(
            '[data-slot="status-monitor"]',
          )?.nextElementSibling;
          if (nextMonitor) {
            const nextTracker = nextMonitor.querySelector('[role="toolbar"]');
            if (nextTracker) {
              const buttons = nextTracker.querySelectorAll('[role="button"]');
              const button = buttons?.[focusedIndex] as HTMLElement;
              if (button) {
                button.focus();
              }
            }
          }
          break;
        case "Enter":
        case "Escape":
        case " ":
          e.preventDefault();
          handleBarClick(focusedIndex);
          break;
      }
    }
  };

  const handleBarClick = (index: number) => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (pinnedIndex === index) {
      setPinnedIndex(null);
    } else {
      setPinnedIndex(index);
    }
  };

  const handleBarFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBarBlur = (e: React.FocusEvent, _currentIndex: number) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToAnotherBar =
      relatedTarget &&
      relatedTarget.closest('[role="toolbar"]') === containerRef.current &&
      relatedTarget.getAttribute("role") === "button";

    if (!isMovingToAnotherBar) {
      setFocusedIndex(null);
    }
  };

  const handleBarMouseEnter = (index: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredIndex(index);
  };

  const handleBarMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredIndex(null);
    }, 100);
  };

  const handleHoverCardMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleHoverCardMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex h-[50px] w-full items-end"
      onKeyDown={handleKeyDown}
      role="toolbar"
      aria-label="Status tracker"
    >
      {data.map((item, index) => {
        const isPinned = pinnedIndex === index;
        const isFocused = focusedIndex === index;
        const isHovered = hoveredIndex === index;

        return (
          <HoverCard
            key={item.day}
            openDelay={0}
            closeDelay={0}
            open={isPinned || isFocused || isHovered}
          >
            <HoverCardTrigger asChild>
              <div
                className={cn(
                  "group relative mx-px flex h-full w-full cursor-pointer flex-col rounded-full outline-none first:ml-0 last:mr-0 hover:opacity-80 focus-visible:opacity-80 focus-visible:ring-[2px] focus-visible:ring-ring/50 data-[aria-pressed=true]:opacity-80",
                )}
                onClick={() => handleBarClick(index)}
                onFocus={() => handleBarFocus(index)}
                onBlur={(e) => handleBarBlur(e, index)}
                onMouseEnter={() => handleBarMouseEnter(index)}
                onMouseLeave={handleBarMouseLeave}
                tabIndex={
                  index === data.length - 1 && focusedIndex === null
                    ? 0
                    : isFocused
                      ? 0
                      : -1
                }
                role="button"
                aria-label={`Day ${index + 1} status`}
                aria-pressed={isPinned}
              >
                {/* Render processed bar segments from backend */}
                {item.bar.map((segment, segmentIndex) => (
                  <div
                    key={`${item.day}-${segment.status}-${segmentIndex}`}
                    className="w-full rounded-full transition-all"
                    style={{
                      height: `${segment.height}%`,
                      backgroundColor: chartConfig[segment.status].color,
                    }}
                  />
                ))}
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              align="center"
              // NOTE: remove animation and transition to avoid flickering
              className="![animation-duration:0ms] ![transition-duration:0ms] w-auto min-w-40 p-0"
              onMouseEnter={handleHoverCardMouseEnter}
              onMouseLeave={handleHoverCardMouseLeave}
            >
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
                  {/* Render processed card data from backend */}
                  {item.card.map((cardItem, cardIndex) => (
                    <StatusTrackerContent
                      key={`${item.day}-card-${cardIndex}`}
                      status={cardItem.status}
                      value={cardItem.value}
                    />
                  ))}
                </div>
                {item.events.length > 0 && (
                  <>
                    <Separator />
                    <div className="p-2">
                      {item.events.map((event) => {
                        const eventStatus =
                          event.type === "incident"
                            ? "error"
                            : event.type === "report"
                              ? "degraded"
                              : "info";

                        const content = (
                          <StatusTrackerEvent
                            key={`${event.id}-${event.type}`}
                            status={eventStatus}
                            name={event.name}
                            from={event.from}
                            to={event.to}
                          />
                        );

                        // Wrap reports and maintenances with links
                        if (
                          event.type === "report" ||
                          event.type === "maintenance"
                        ) {
                          return (
                            <Link
                              key={event.id}
                              href={`${
                                prefix ? `/${prefix}` : ""
                              }/events/report/${event.id}`}
                            >
                              {content}
                            </Link>
                          );
                        }

                        // Incidents don't have links
                        return content;
                      })}
                    </div>
                  </>
                )}
                {isPinned && !isTouch && (
                  <>
                    <Separator />
                    <div className="flex cursor-pointer items-center p-2 text-muted-foreground text-xs">
                      <span>Click again to unpin</span>
                      <Kbd>Esc</Kbd>
                    </div>
                  </>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}

export function StatusTrackerSkeleton({
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

function StatusTrackerContent({
  status,
  value,
}: {
  status: "success" | "degraded" | "error" | "info" | "empty";
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-sm"
          style={{
            backgroundColor: chartConfig[status].color,
          }}
        />
        <div className="text-sm">{requests[status]}</div>
      </div>
      <div className="ml-auto font-mono text-muted-foreground text-xs tracking-tight">
        {value}
      </div>
    </div>
  );
}

function StatusTrackerEvent({
  name,
  from,
  to,
  status,
}: {
  name: string;
  from?: Date | null;
  to?: Date | null;
  status: "success" | "degraded" | "error" | "info" | "empty";
}) {
  if (!from) return null;

  return (
    <div className="group relative text-sm">
      {/* NOTE: this is to make the text truncate based on the with of the sibling element */}
      {/* REMINDER: height needs to be equal the text height */}
      <div className="h-4 w-full" />
      <div className="absolute inset-0 text-muted-foreground hover:text-foreground">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{
              backgroundColor: chartConfig[status].color,
            }}
          />
          <div className="truncate">{name}</div>
        </div>
      </div>
      <div className="mt-1 text-muted-foreground text-xs">
        {formatDateRange(from, to ?? undefined)}{" "}
        <span className="ml-1.5 font-mono text-muted-foreground/70">
          {formatDuration({ from, to, name, status })}
        </span>
      </div>
    </div>
  );
}

const formatDuration = ({
  from,
  to,
  name,
}: React.ComponentProps<typeof StatusTrackerEvent>) => {
  if (!from) return null;
  if (!to) return "ongoing";
  const duration = formatDistanceStrict(from, to);
  const isMultipleIncidents = name.includes("Downtime (");
  if (isMultipleIncidents) return `across ${duration}`;
  if (duration === "0 seconds") return null;
  return duration;
};
