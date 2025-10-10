"use client";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import Link from "next/link";
import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankDescription,
  StatusBlankLink,
  StatusBlankReport,
  StatusBlankTitle,
} from "./status-blank";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventAside,
  StatusEventContent,
  StatusEventDate,
  StatusEventGroup,
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
      <StatusBlankContainer>
        <div className="relative mt-8 flex w-full flex-col items-center justify-center">
          <StatusBlankReport className="-top-16 absolute scale-60 opacity-50" />
          <StatusBlankReport className="-top-8 absolute scale-80 opacity-80" />
          <StatusBlankReport />
        </div>
        <StatusBlankContent>
          <StatusBlankTitle>No recent notifications</StatusBlankTitle>
          <StatusBlankDescription>
            There have been no reports within the last 7 days.
          </StatusBlankDescription>
          <StatusBlankLink href={`${prefix ? `/${prefix}` : ""}/events`}>
            View all reports
          </StatusBlankLink>
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  return (
    <StatusEventGroup {...props}>
      {unifiedEvents.map((event) => {
        if (event.type === "report") {
          const report = event.data as StatusReport;
          return (
            <StatusEvent key={`report-${event.id}`}>
              <StatusEventAside>
                <StatusEventDate date={event.startDate} />
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
                    <StatusEventAffected>
                      {report.affected.map((affected, index) => (
                        <StatusEventAffectedBadge key={index}>
                          {affected}
                        </StatusEventAffectedBadge>
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
          return (
            <StatusEvent key={`maintenance-${event.id}`}>
              <StatusEventAside>
                <StatusEventDate date={event.startDate} />
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
                    <StatusEventAffected>
                      {maintenance.affected.map((affected, index) => (
                        <StatusEventAffectedBadge key={index}>
                          {affected}
                        </StatusEventAffectedBadge>
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
      <StatusBlankLink
        className="mx-auto"
        href={`${prefix ? `/${prefix}` : ""}/events`}
      >
        View all events
      </StatusBlankLink>
    </StatusEventGroup>
  );
}
