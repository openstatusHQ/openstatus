"use client";

import { Kbd } from "@/components/common/kbd";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { statusReports } from "@/data/status-reports";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatDistanceStrict, isSameDay } from "date-fns";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type CardType, VARIANT } from "./floating-button";
import { messages } from "./messages";
import { chartConfig, chartData } from "./utils";

const STATUS = VARIANT;

export function StatusTracker({ type = "detailed" }: { type?: CardType }) {
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
      className="flex h-[50px] w-full items-end gap-px xs:gap-0.5 sm:gap-1"
      onKeyDown={handleKeyDown}
    >
      {chartData.map((item, index) => {
        const total = item.success + item.degraded + item.info + item.error;
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
                className="group relative flex h-full w-full cursor-pointer flex-col transition-opacity hover:opacity-80"
                onClick={() => handleBarClick(index)}
              >
                {STATUS.map((status) => {
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
                      }}
                    />
                  );
                })}
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
                  {type === "detailed" ? (
                    <StatusTrackerContentDetailed item={item} />
                  ) : (
                    <StatusTrackerContentCompact item={item} />
                  )}
                </div>
                {reports.length > 0 ? (
                  <>
                    <Separator />
                    <div className="p-2">
                      {reports.map((report) => (
                        <Link key={report.id} href={"#"}>
                          <div className="group flex items-center justify-between text-muted-foreground text-sm hover:text-foreground">
                            <div>{report.name}</div>
                            <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </Link>
                      ))}
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

function StatusTrackerContentDetailed({
  item,
}: {
  item: (typeof chartData)[number];
}) {
  return STATUS.map((status) => {
    const value = item[status];
    if (value === 0) return null;

    // const percentage = ((value / total) * 100).toFixed(1);

    const now = new Date();
    const duration = formatDistanceStrict(
      now,
      new Date(now.getTime() + value * 60 * 1000),
    );

    return (
      <div key={status} className="flex items-baseline gap-4">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-sm"
            style={{
              backgroundColor: chartConfig[status].color,
            }}
          />
          <div className="text-sm">{messages.short[status]}</div>
        </div>
        <div className="ml-auto font-mono text-muted-foreground text-xs tracking-tight">
          {duration}
        </div>
      </div>
    );
  });
}

const priority = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
} as const;

function StatusTrackerContentCompact({
  item,
}: {
  item: (typeof chartData)[number];
}) {
  const highestPriorityStatus =
    STATUS.filter((status) => item[status] > 0).sort(
      (a, b) => priority[b] - priority[a],
    )[0] || "success";

  return (
    <div className="flex min-w-32 items-baseline gap-4">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-sm"
          style={{
            backgroundColor: chartConfig[highestPriorityStatus].color,
          }}
        />
        <div className="text-sm">{messages.short[highestPriorityStatus]}</div>
      </div>
    </div>
  );
}
