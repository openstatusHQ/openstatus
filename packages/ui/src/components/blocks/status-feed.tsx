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
 * isStatusReport - Type guard for discriminating status reports
 *
 * Type guard function that narrows a UnifiedEvent to a status report event.
 * Used internally by StatusFeed to distinguish between reports and maintenance.
 *
 * @param event - The unified event to check
 * @returns True if the event is a status report
 *
 * @example
 * ```tsx
 * if (isStatusReport(event)) {
 *   // TypeScript knows event.data is StatusReport
 *   console.log(event.data.updates);
 * }
 * ```
 */
function isStatusReport(
  event: UnifiedEvent,
): event is UnifiedEvent & { type: "report"; data: StatusReport } {
  return event.type === "report";
}

/**
 * isMaintenance - Type guard for discriminating maintenance events
 *
 * Type guard function that narrows a UnifiedEvent to a maintenance event.
 * Used internally by StatusFeed to distinguish between reports and maintenance.
 *
 * @param event - The unified event to check
 * @returns True if the event is a maintenance
 *
 * @example
 * ```tsx
 * if (isMaintenance(event)) {
 *   // TypeScript knows event.data is Maintenance
 *   console.log(event.data.from, event.data.to);
 * }
 * ```
 */
function isMaintenance(
  event: UnifiedEvent,
): event is UnifiedEvent & { type: "maintenance"; data: Maintenance } {
  return event.type === "maintenance";
}

/**
 * StatusFeed - Unified feed of incident reports and maintenance events
 *
 * Displays a chronological feed combining both status reports (incidents) and
 * scheduled maintenance, sorted by date from newest to oldest. The component
 * intelligently merges the two event types and renders them using a discriminated
 * union pattern for type safety.
 *
 * **Key Features**:
 * - **Unified Timeline**: Combines reports and maintenance in chronological order
 * - **Discriminated Union**: Type-safe rendering using TypeScript discriminated unions
 * - **Memoization**: Uses `useMemo` to prevent flicker on re-renders
 * - **Empty State**: Shows a styled empty state when no events are present
 * - **Automatic Rendering**: Each event type is rendered with appropriate components
 *
 * **Data Structure**:
 * - **StatusReport**: Incident reports with updates timeline
 *   - id, title, affected services
 *   - updates array with status, message, date
 * - **Maintenance**: Scheduled maintenance windows
 *   - id, title, message, affected services
 *   - from/to date range
 *
 * The component creates a unified event array internally, using stable keys
 * (`${type}-${id}`) to prevent React flicker when data updates.
 *
 * @param statusReports - Array of incident reports to display
 * @param maintenances - Array of maintenance events to display
 *
 * @example
 * // Feed with both reports and maintenance
 * ```tsx
 * <StatusFeed
 *   statusReports={[
 *     {
 *       id: 1,
 *       title: "API Outage",
 *       affected: ["API", "Database"],
 *       updates: [
 *         {
 *           status: "resolved",
 *           message: "All systems operational",
 *           date: new Date("2024-01-15T12:00:00Z")
 *         },
 *         {
 *           status: "investigating",
 *           message: "Investigating API timeouts",
 *           date: new Date("2024-01-15T11:00:00Z")
 *         }
 *       ]
 *     }
 *   ]}
 *   maintenances={[
 *     {
 *       id: 2,
 *       title: "Database Upgrade",
 *       message: "Upgrading to PostgreSQL 15",
 *       affected: ["Database"],
 *       from: new Date("2024-01-20T02:00:00Z"),
 *       to: new Date("2024-01-20T04:00:00Z")
 *     }
 *   ]}
 * />
 * ```
 *
 * @example
 * // Empty state (no events)
 * ```tsx
 * <StatusFeed statusReports={[]} maintenances={[]} />
 * // Displays: "No recent notifications" empty state
 * ```
 *
 * @example
 * // Only incident reports
 * ```tsx
 * <StatusFeed
 *   statusReports={incidentReports}
 *   maintenances={[]}
 * />
 * ```
 *
 * @see StatusEventGroup - For the feed container
 * @see StatusEventTimelineReport - For incident rendering
 * @see StatusEventTimelineMaintenance - For maintenance rendering
 * @see isStatusReport - For type guard discrimination
 * @see isMaintenance - For type guard discrimination
 */
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
