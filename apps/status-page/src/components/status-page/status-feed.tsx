"use client";

import { Badge } from "@/components/ui/badge";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { formatDate } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { Newspaper } from "lucide-react";
import Link from "next/link";
import {
  StatusEmptyState,
  StatusEmptyStateDescription,
  StatusEmptyStateTitle,
} from "./status";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAside,
  StatusEventContent,
  StatusEventTimelineMaintenance,
  StatusEventTimelineReport,
  StatusEventTitle,
} from "./status-events";

type StatusReport = {
  id: number;
  title: string;
  affected: string[];
  updates: {
    date: Date;
    message: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
  }[];
};

type Maintenance = {
  id: number;
  title: string;
  message: string;
  from: Date;
  to: Date;
  affected: string[];
};

type UnifiedEvent = {
  id: number;
  title: string;
  type: "report" | "maintenance";
  startDate: Date;
  data: StatusReport | Maintenance;
};

export function StatusFeed({
  className,
  statusReports = [],
  maintenances = [],
  ...props
}: React.ComponentProps<"div"> & {
  statusReports?: StatusReport[];
  maintenances?: Maintenance[];
  showLinks?: boolean;
}) {
  const prefix = usePathnamePrefix();
  const unifiedEvents: UnifiedEvent[] = [
    ...statusReports.map((report) => ({
      id: report.id,
      title: report.title,
      type: "report" as const,
      // FIXME: we have a flicker here when the report is updated
      startDate: report.updates[report.updates.length - 1]?.date || new Date(),
      data: report,
    })),
    ...maintenances.map((maintenance) => ({
      id: maintenance.id,
      title: maintenance.title,
      type: "maintenance" as const,
      startDate: maintenance.from,
      data: maintenance,
    })),
  ].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  if (unifiedEvents.length === 0) {
    return (
      <StatusEmptyState>
        <Newspaper className="size-4 text-muted-foreground" />
        <StatusEmptyStateTitle>No recent notifications</StatusEmptyStateTitle>
        <StatusEmptyStateDescription>
          There have been no reports within the last 7 days.
        </StatusEmptyStateDescription>
      </StatusEmptyState>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      {unifiedEvents.map((event) => {
        if (event.type === "report") {
          const report = event.data as StatusReport;
          return (
            <StatusEvent key={`report-${event.id}`}>
              <StatusEventAside>
                <span className="font-medium text-foreground/80">
                  {formatDate(event.startDate, { month: "short" })}
                </span>
              </StatusEventAside>
              <Link
                href={`${prefix ? `/${prefix}` : ""}/events/report/${
                  report.id
                }`}
                className="rounded-lg"
              >
                <StatusEventContent>
                  <StatusEventTitle>{report.title}</StatusEventTitle>
                  {report.affected.length > 0 && (
                    <StatusEventAffected className="flex flex-wrap gap-1">
                      {report.affected.map((affected, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {affected}
                        </Badge>
                      ))}
                    </StatusEventAffected>
                  )}
                  <StatusEventTimelineReport updates={report.updates} />
                </StatusEventContent>
              </Link>
            </StatusEvent>
          );
        }

        if (event.type === "maintenance") {
          const maintenance = event.data as Maintenance;
          const isFuture = maintenance.from > new Date();
          return (
            <StatusEvent key={`maintenance-${event.id}`}>
              <StatusEventAside>
                <span className="font-medium text-foreground/80">
                  {formatDate(event.startDate, { month: "short" })}
                </span>
                {isFuture ? (
                  <span className="text-info text-sm">Upcoming</span>
                ) : null}
              </StatusEventAside>
              <Link
                href={`${prefix ? `/${prefix}` : ""}/events/maintenance/${
                  maintenance.id
                }`}
                className="rounded-lg"
              >
                <StatusEventContent>
                  <StatusEventTitle>{maintenance.title}</StatusEventTitle>
                  {maintenance.affected.length > 0 && (
                    <StatusEventAffected className="flex flex-wrap gap-1">
                      {maintenance.affected.map((affected, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {affected}
                        </Badge>
                      ))}
                    </StatusEventAffected>
                  )}
                  <StatusEventTimelineMaintenance
                    maintenance={{
                      title: maintenance.title,
                      message: maintenance.message,
                      from: maintenance.from,
                      to: maintenance.to,
                    }}
                  />
                </StatusEventContent>
              </Link>
            </StatusEvent>
          );
        }
        return null;
      })}
    </div>
  );
}
