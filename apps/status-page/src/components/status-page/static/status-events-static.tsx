"use client";

import { ProcessMessage } from "@/components/content/process-message";
import { TimestampHoverCard } from "@/components/content/timestamp-hover-card";
import { formatDateTime } from "@/lib/formatter";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceStrict } from "date-fns";
import {
  StatusEventTimelineDot,
  StatusEventTimelineMessage,
  StatusEventTimelineSeparator,
  StatusEventTimelineTitle,
} from "../status-events";

export function StatusEventTimelineReportStatic({
  className,
  updates,
  withDot = true,
  maxUpdates,
  ...props
}: React.ComponentProps<"div"> & {
  reportId: number;
  updates: {
    date: Date;
    message: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
  }[];
  withDot?: boolean;
  maxUpdates?: number;
}) {
  const sortedUpdates = [...updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const displayedUpdates = maxUpdates
    ? sortedUpdates.slice(0, maxUpdates)
    : sortedUpdates;

  const statusLabels = {
    resolved: "Resolved",
    monitoring: "Monitoring",
    identified: "Identified",
    investigating: "Investigating",
  } as const;

  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
      {displayedUpdates.map((update, index) => {
        const updateDate = new Date(update.date);
        let durationText: string | undefined;

        if (index === 0) {
          const startedAt = new Date(
            sortedUpdates[sortedUpdates.length - 1].date,
          );
          const duration = formatDistanceStrict(startedAt, updateDate);

          if (duration !== "0 seconds" && update.status === "resolved") {
            durationText = `(in ${duration})`;
          }
        } else {
          const lastUpdateDate = new Date(displayedUpdates[index - 1].date);
          const timeFromLast = formatDistanceStrict(
            updateDate,
            lastUpdateDate,
          );
          durationText = `(${timeFromLast} earlier)`;
        }

        return (
          <div key={index} data-variant={update.status} className="group">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex flex-row gap-4">
                {withDot ? (
                  <div className="flex flex-col">
                    <div className="flex h-5 flex-col items-center justify-center">
                      <StatusEventTimelineDot />
                    </div>
                    {index !== displayedUpdates.length - 1 ? (
                      <StatusEventTimelineSeparator />
                    ) : null}
                  </div>
                ) : null}
                <div
                  className={cn(
                    index === displayedUpdates.length - 1 ? "mb-0" : "mb-2",
                  )}
                >
                  <StatusEventTimelineTitle>
                    <span>{statusLabels[update.status]}</span>{" "}
                    <span className="text-muted-foreground/70">&middot;</span>{" "}
                    <span className="font-mono text-muted-foreground text-xs">
                      <TimestampHoverCard
                        date={new Date(update.date)}
                        asChild
                      >
                        <span>{formatDateTime(update.date)}</span>
                      </TimestampHoverCard>
                    </span>{" "}
                    {durationText ? (
                      <span className="font-mono text-muted-foreground/70 text-xs">
                        {durationText}
                      </span>
                    ) : null}
                  </StatusEventTimelineTitle>
                  <StatusEventTimelineMessage>
                    {update.message.trim() === "" ? (
                      <span className="text-muted-foreground/70">-</span>
                    ) : (
                      <ProcessMessage value={update.message} />
                    )}
                  </StatusEventTimelineMessage>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
