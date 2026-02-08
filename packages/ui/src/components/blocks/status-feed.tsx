"use client";
import { useMemo } from "react";
import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankDescription,
  StatusBlankReport,
  StatusBlankTitle,
} from "@openstatus/ui/components/blocks/status-blank";
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
} from "@openstatus/ui/components/blocks/status-events";
import type {
  StatusReport,
  Maintenance,
} from "@openstatus/ui/components/blocks/status.types";

type UnifiedEvent = {
  id: number;
  title: string;
  startDate: Date;
} & (
  | { type: "report"; data: StatusReport }
  | { type: "maintenance"; data: Maintenance }
);

/**
 * Type guard to check if an event is a status report
 */
function isStatusReport(
  event: UnifiedEvent,
): event is UnifiedEvent & { type: "report"; data: StatusReport } {
  return event.type === "report";
}

/**
 * Type guard to check if an event is a maintenance
 */
function isMaintenance(
  event: UnifiedEvent,
): event is UnifiedEvent & { type: "maintenance"; data: Maintenance } {
  return event.type === "maintenance";
}

export function StatusFeed({
  statusReports = [],
  maintenances = [],
  ...props
}: React.ComponentProps<"div"> & {
  statusReports?: StatusReport[];
  maintenances?: Maintenance[];
}) {
  // Memoize the unified events array to prevent flicker on re-renders
  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    return [
      ...statusReports.map(
        (report): UnifiedEvent => ({
          id: report.id,
          title: report.title,
          type: "report",
          startDate:
            report.updates[report.updates.length - 1]?.date || new Date(),
          data: report,
        }),
      ),
      ...maintenances.map(
        (maintenance): UnifiedEvent => ({
          id: maintenance.id,
          title: maintenance.title,
          type: "maintenance",
          startDate: maintenance.from,
          data: maintenance,
        }),
      ),
    ].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }, [statusReports, maintenances]);

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
        </StatusBlankContent>
      </StatusBlankContainer>
    );
  }

  return (
    <StatusEventGroup {...props}>
      {unifiedEvents.map((event) => {
        // Use stable key to prevent flicker
        const key = `${event.type}-${event.id}`;

        if (isStatusReport(event)) {
          const report = event.data;
          return (
            <StatusEvent key={key}>
              <StatusEventAside>
                <StatusEventDate date={event.startDate} />
              </StatusEventAside>
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
            </StatusEvent>
          );
        }

        if (isMaintenance(event)) {
          const maintenance = event.data;
          return (
            <StatusEvent key={key}>
              <StatusEventAside>
                <StatusEventDate date={event.startDate} />
              </StatusEventAside>
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
            </StatusEvent>
          );
        }
        return null;
      })}
    </StatusEventGroup>
  );
}
