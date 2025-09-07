"use client";

import { Kbd } from "@/components/common/kbd";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { formatDateRange, formatNumber } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import {
  endOfDay,
  formatDistanceStrict,
  isSameDay,
  isWithinInterval,
  startOfDay,
} from "date-fns";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type BarType, type CardType, VARIANT } from "./floating-button";
import { requests } from "./messages";
import {
  type ChartData,
  chartConfig,
  getPercentagePriorityStatus,
} from "./utils";

// TODO: keyboard arrow navigation
// FIXME: on small screens, avoid pinned state
// TODO: only on real mobile devices, use click events
// TODO: improve status reports -> add duration and time
// TODO: support headless mode -> both card and bar type share only maintenance or degraded mode
// TODO: support status page logo + onClick to homepage
// TODO: widget type -> current status only | with status history

const STATUS = VARIANT;

export function StatusTracker({
  cardType = "duration",
  barType = "absolute",
  data,
  events,
}: {
  cardType?: CardType;
  barType?: BarType;
  data: ChartData[];
  events?: {
    id: number;
    name: string;
    from: Date | null;
    to: Date | null;
    type: "maintenance" | "incident" | "report";
  }[];
}) {
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setPinnedIndex(null);
      setFocusedIndex(null);
      setHoveredIndex(null);
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
        case "Enter":
        case " ":
          e.preventDefault();
          handleBarClick(focusedIndex);
          break;
      }
    }
  };

  const handleBarClick = (index: number) => {
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
    setHoveredIndex(index);
  };

  const handleBarMouseLeave = () => {
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

        const r =
          events?.filter((report) => {
            if (report.type !== "report") return false;
            if (!report.from) return false;
            const itemDate = new Date(item.timestamp);
            return isWithinInterval(itemDate, {
              start: startOfDay(report.from),
              end: endOfDay(report.to ?? new Date()),
            });
          }) || [];

        const m =
          events?.filter((maintenance) => {
            if (maintenance.type !== "maintenance") return false;
            if (!maintenance.from || !maintenance.to) return false;
            const itemDate = new Date(item.timestamp);
            return isWithinInterval(itemDate, {
              start: startOfDay(maintenance.from),
              end: endOfDay(maintenance.to),
            });
          }) || [];

        const i =
          events?.filter((incident) => {
            if (incident.type !== "incident") return false;
            if (!incident.from) return false;
            const itemDate = new Date(item.timestamp);
            return isWithinInterval(itemDate, {
              start: startOfDay(incident.from),
              end: endOfDay(incident.to ?? new Date()),
            });
          }) || [];

        const hasMaintenances = m && m.length > 0;
        const hasReports = r && r.length > 0;
        const hasIncidents = i && i.length > 0;

        const status = hasIncidents
          ? "error"
          : hasReports
            ? "degraded"
            : hasMaintenances
              ? "info"
              : undefined;

        return (
          <HoverCard
            key={item.timestamp}
            openDelay={0}
            closeDelay={0}
            open={isPinned || isFocused || isHovered}
          >
            <HoverCardTrigger asChild>
              <div
                className={cn(
                  "group relative flex h-full w-full cursor-pointer flex-col px-px hover:opacity-80 data-[aria-pressed=true]:opacity-80 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1",
                )}
                onClick={() => handleBarClick(index)}
                onFocus={() => handleBarFocus(index)}
                onBlur={(e) => handleBarBlur(e, index)}
                onMouseEnter={() => handleBarMouseEnter(index)}
                onMouseLeave={handleBarMouseLeave}
                tabIndex={
                  index === 0 && focusedIndex === null ? 0 : isFocused ? 0 : -1
                }
                role="button"
                aria-label={`Day ${index + 1} status`}
                aria-pressed={isPinned}
              >
                {(() => {
                  switch (barType) {
                    case "absolute":
                      return (
                        <StatusTrackerTriggerAbsolute
                          item={item}
                          status={status}
                        />
                      );
                    case "dominant":
                      return (
                        <StatusTrackerTriggerDominant
                          item={item}
                          status={status}
                        />
                      );
                    case "manual":
                      return (
                        <StatusTrackerTriggerManual
                          status={status ?? "success"}
                        />
                      );
                    default:
                      return null;
                  }
                })()}
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              align="center"
              // NOTE: remove animation and transition to avoid flickering
              className="min-w-40 w-auto p-0 ![animation-duration:0ms] ![transition-duration:0ms]"
            >
              <div>
                <div className="p-2 text-xs">
                  {new Date(item.timestamp).toLocaleDateString("default", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <Separator />
                <div className="space-y-1 p-2 text-sm">
                  {(() => {
                    switch (cardType) {
                      case "duration":
                        return <StatusTrackerContentDuration item={item} />;
                      case "dominant":
                        return <StatusTrackerContentDominant item={item} />;
                      case "requests":
                        return <StatusTrackerContentRequests item={item} />;
                      case "manual":
                        return (
                          <StatusTrackerContentManual
                            status={status ?? "success"}
                          />
                        );
                      default:
                        return null;
                    }
                  })()}
                </div>
                {r.length > 0 || m.length > 0 ? (
                  <>
                    <Separator />
                    <div className="p-2">
                      {i.length > 0
                        ? i.map((incident) => {
                            return (
                              <StatusTrackerEvent
                                key={incident.id}
                                status="error"
                                name="Incident"
                                from={incident.from}
                                to={incident.to}
                              />
                            );
                          })
                        : null}
                      {r.length > 0
                        ? r.map((report) => {
                            return (
                              <Link
                                key={report.id}
                                href={`/${prefix}/events/report/${report.id}`}
                              >
                                <StatusTrackerEvent
                                  status="degraded"
                                  name={report.name}
                                  from={report.from}
                                  to={report.to}
                                />
                              </Link>
                            );
                          })
                        : null}
                      {m.length > 0
                        ? m.map((maintenance) => {
                            return (
                              <Link
                                key={maintenance.id}
                                href={`/${prefix}/events/maintenance/${maintenance.id}`}
                              >
                                <StatusTrackerEvent
                                  status="info"
                                  name={maintenance.name}
                                  from={maintenance.from}
                                  to={maintenance.to}
                                />
                              </Link>
                            );
                          })
                        : null}
                    </div>
                  </>
                ) : null}
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

interface StatusTrackerTriggerAbsoluteProps {
  item: ChartData;
  status?: keyof typeof chartConfig;
}

function StatusTrackerTriggerAbsolute({
  item,
  status,
}: StatusTrackerTriggerAbsoluteProps) {
  const total = item.success + item.degraded + item.info + item.error;
  const statusColor = status ? chartConfig[status].color : undefined;

  if (total === 0) {
    return (
      <div
        key={`${item.timestamp}-empty`}
        className="w-full transition-all h-full"
        style={{
          backgroundColor: statusColor ?? chartConfig.empty.color,
        }}
      />
    );
  }

  return STATUS.map((status) => {
    const value = item[status as keyof typeof item] as number;
    if (value === 0) return null;
    const heightPercentage = (value / total) * 100;
    return (
      <div
        key={`${item.timestamp}-${status}`}
        className="w-full transition-all"
        style={{
          height: `${heightPercentage}%`,
          backgroundColor: chartConfig[status].color,
          // IDEA: only for status === "success", make the color less pop to emphasize the other statuses
        }}
      />
    );
  });
}

interface StatusTrackerTriggerDominantProps {
  item: ChartData;
  status?: keyof typeof chartConfig;
}

function StatusTrackerTriggerDominant({
  item,
  status,
}: StatusTrackerTriggerDominantProps) {
  const statusColor = status ? chartConfig[status].color : undefined;
  const statusPriority = getPercentagePriorityStatus(item);

  return (
    <div
      key={`${item.timestamp}-${statusPriority}`}
      className="w-full transition-all"
      style={{
        height: "100%",
        backgroundColor: statusColor ?? chartConfig[statusPriority].color,
      }}
    />
  );
}

interface StatusTrackerTriggerManualProps {
  status: keyof typeof chartConfig;
}

function StatusTrackerTriggerManual({
  status,
}: StatusTrackerTriggerManualProps) {
  return (
    <div
      className="w-full transition-all"
      style={{
        height: "100%",
        backgroundColor: chartConfig[status].color,
      }}
    />
  );
}

function StatusTrackerContentDuration({ item }: { item: ChartData }) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) {
    return <StatusTrackerContent status="empty" value="1 day" />;
  }

  return STATUS.map((status) => {
    const value = item[status];
    if (value === 0) return null;

    const percentage = Math.round((value / total) * 1000) / 1000;
    const isToday = isSameDay(new Date(item.timestamp), new Date());

    const hours = isToday ? new Date().getUTCHours() : 24;

    const now = new Date();
    const duration = formatDistanceStrict(
      now,
      new Date(now.getTime() + percentage * hours * 60 * 60 * 1000),
    );

    // NOTE: skip seconds because they are too short and not useful
    if (duration.endsWith("seconds")) return null;

    return (
      <StatusTrackerContent key={status} status={status} value={duration} />
    );
  });
}

function StatusTrackerContentDominant({ item }: { item: ChartData }) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) {
    return <StatusTrackerContent status="empty" value="" />;
  }

  const status = getPercentagePriorityStatus(item);

  return <StatusTrackerContent key={status} status={status} value={""} />;
}

function StatusTrackerContentRequests({ item }: { item: ChartData }) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) {
    return <StatusTrackerContent status="empty" value="1 day" />;
  }

  return STATUS.map((status) => {
    const value = item[status];
    if (value === 0) return null;

    return (
      <StatusTrackerContent
        key={status}
        status={status}
        value={`${formatNumber(value)} reqs`}
      />
    );
  });
}

function StatusTrackerContentManual({
  status,
}: {
  status: keyof typeof chartConfig;
}) {
  return <StatusTrackerContent status={status} value="" />;
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
  const duration = to ? formatDistanceStrict(from, to) : "ongoing";
  return (
    <div className="group relative text-sm">
      {/* NOTE: this is to make the text truncate based on the with of the sibling element */}
      {/* REMINDER: height needs to be equal the text height */}
      <div className="h-4 w-full" />
      <div className="absolute inset-0 text-muted-foreground hover:text-foreground">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-sm shrink-0"
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
          {duration}
        </span>
      </div>
    </div>
  );
}
