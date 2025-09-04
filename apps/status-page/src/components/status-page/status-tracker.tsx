"use client";

import { Kbd } from "@/components/common/kbd";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
// TODO: make it a property of the component
import { statusReports } from "@/data/status-reports";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatDateRange } from "@/lib/formatter";
import { formatDistanceStrict, isSameDay } from "date-fns";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type BarType, type CardType, VARIANT } from "./floating-button";
import { requests } from "./messages";
import { type ChartData, chartConfig, getHighestPriorityStatus } from "./utils";

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
}: {
  cardType?: CardType;
  barType?: BarType;
  data: ChartData[];
}) {
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouch = useMediaQuery("(hover: none)");

  // Window-level Escape key listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pinnedIndex !== null) {
        setPinnedIndex(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [pinnedIndex]);

  // Document-level outside click listener
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

  // Handle keyboard events for accessibility (kept for fallback)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setPinnedIndex(null);
    }
  };

  const handleBarClick = (index: number) => {
    // Toggle pinned state: if clicking the same bar, unpin it; otherwise, pin the new bar
    if (pinnedIndex === index) {
      setPinnedIndex(null);
    } else {
      setPinnedIndex(index);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex h-[50px] w-full items-end"
      onKeyDown={handleKeyDown}
      // tabIndex={0}
    >
      {data.map((item, index) => {
        const isPinned = pinnedIndex === index;

        const reports = statusReports.filter((report) => {
          const reportDate = new Date(report.startedAt);
          const itemDate = new Date(item.timestamp);
          return isSameDay(reportDate, itemDate);
        });

        return (
          <HoverCard
            key={item.timestamp}
            openDelay={0}
            closeDelay={0}
            open={isPinned ? true : undefined}
          >
            <HoverCardTrigger asChild>
              <div
                className="group relative flex h-full w-full cursor-pointer flex-col px-px transition-opacity hover:opacity-80" // sm:px-0.5
                onClick={() => handleBarClick(index)}
              >
                {(() => {
                  switch (barType) {
                    case "absolute":
                      return <StatusTrackerTriggerAbsolute item={item} />;
                    case "dominant":
                      return <StatusTrackerTriggerDominant item={item} />;
                    default:
                      return null;
                  }
                })()}
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="center" className="w-auto p-0">
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
                      default:
                        return null;
                    }
                  })()}
                </div>
                {reports.length > 0 ? (
                  <>
                    <Separator />
                    <div className="p-2">
                      {reports.map((report) => {
                        const updates = report.updates.sort(
                          (a, b) => a.date.getTime() - b.date.getTime(),
                        );
                        const startedAt = new Date(updates[0].date);
                        const endedAt = new Date(
                          updates[updates.length - 1].date,
                        );
                        const duration = formatDistanceStrict(
                          startedAt,
                          endedAt,
                        );
                        return (
                          <Link
                            key={report.id}
                            href="/status-page/events/report"
                          >
                            <div className="group relative text-sm">
                              {/* NOTE: this is to make the text truncate based on the with of the sibling element */}
                              {/* REMINDER: height needs to be equal the text height */}
                              <div className="h-4 w-full" />
                              <div className="absolute inset-0 text-muted-foreground hover:text-foreground">
                                <div className="truncate">{report.name}</div>
                              </div>
                              <div className="mt-1 text-muted-foreground text-xs">
                                {formatDateRange(startedAt, endedAt)}{" "}
                                <span className="ml-1.5 font-mono text-muted-foreground/70">
                                  {duration}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
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

function StatusTrackerTriggerAbsolute({ item }: { item: ChartData }) {
  const total = item.success + item.degraded + item.info + item.error;

  if (total === 0) {
    return (
      <div
        key={`${item.timestamp}-empty`}
        className="w-full transition-all h-full"
        style={{
          backgroundColor: chartConfig.empty.color,
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

function StatusTrackerTriggerDominant({ item }: { item: ChartData }) {
  const highestPriorityStatus = getHighestPriorityStatus(item);

  return (
    <div
      key={`${item.timestamp}-${highestPriorityStatus}`}
      className="w-full transition-all"
      style={{
        height: "100%",
        backgroundColor: chartConfig[highestPriorityStatus].color,
      }}
    />
  );
}

function StatusTrackerContentDuration({ item }: { item: ChartData }) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) {
    return <StatusTrackerContent status="empty" value="" />;
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

  const status = getHighestPriorityStatus(item);

  return <StatusTrackerContent key={status} status={status} value={""} />;
}

function StatusTrackerContentRequests({ item }: { item: ChartData }) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) {
    return <StatusTrackerContent status="empty" value="" />;
  }

  return STATUS.map((status) => {
    const value = item[status];
    if (value === 0) return null;

    return (
      <StatusTrackerContent
        key={status}
        status={status}
        value={`${value} req`}
      />
    );
  });
}

function StatusTrackerContent({
  status,
  value,
}: {
  status: "success" | "degraded" | "error" | "info" | "empty";
  value: string;
}) {
  return (
    <div key={status} className="flex min-w-32 items-baseline gap-4">
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
