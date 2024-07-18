"use client";

import type {
  PublicMonitor,
  StatusReportWithUpdates,
} from "@openstatus/db/src/schema";

import { notEmpty } from "@/lib/utils";
import { StatusReport } from "./status-report";
import { EmptyState } from "../dashboard/empty-state";
import { Fragment } from "react";
import { DayHeader } from "./day-header";

export const StatusReportList = ({
  statusReports,
  monitors,
  filter,
}: {
  statusReports: StatusReportWithUpdates[];
  monitors: PublicMonitor[];
  filter?: { date: Date; open?: boolean };
}) => {
  function getFilteredReports() {
    if (!filter?.date) return statusReports;
    return statusReports.filter((report) => {
      if (filter.open && report.status !== "resolved") return true;
      return report.statusReportUpdates.some(
        (update) => update.date.getTime() > filter?.date?.getTime()
      );
    });
  }

  // TODO: group reports by day!
  function groupReportsByDay(reports: StatusReportWithUpdates[]) {
    const grouped = reports.reduce(
      (acc, report) => {
        const firstUpdate = report.statusReportUpdates[0]; // make sure we get the correct order from backend query!
        const date = new Date(firstUpdate.date.toDateString()).getTime();

        const exists = acc.find((item) => item.timestamp === date);

        if (exists) {
          exists.reports.push(report);
        } else {
          acc.push({ timestamp: date, reports: [report] });
        }

        return acc;
      },
      [] as { timestamp: number; reports: StatusReportWithUpdates[] }[]
    );

    grouped.sort((a, b) => b.timestamp - a.timestamp);

    return grouped;
  }

  const reports = getFilteredReports().sort((a, b) => {
    if (a.updatedAt === undefined || a.updatedAt === null) return 1;
    if (b?.updatedAt === undefined || b.updatedAt === null) return -1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  if (!reports.length) {
    return (
      <EmptyState
        icon="siren"
        title="No latest incidents"
        description="There have been no incidents within the last 7 days."
      />
    );
  }

  const reportsGroupedByDay = groupReportsByDay(reports);

  return (
    <div className="grid gap-4">
      {/* TODO: dynamic */}
      {reportsGroupedByDay.map((group) => {
        return (
          <Fragment key={group.timestamp}>
            <DayHeader date={new Date(group.timestamp)} />
            {group.reports.map((report, i) => {
              const affectedMonitors = report.monitorsToStatusReports
                .map(({ monitorId }) => {
                  const monitor = monitors.find(({ id }) => monitorId === id);
                  return monitor || undefined;
                })
                .filter(notEmpty);
              const isLast = reports.length - 1 === i;

              return (
                <div key={report.id} className="grid gap-6">
                  <StatusReport monitors={affectedMonitors} report={report} />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
};
