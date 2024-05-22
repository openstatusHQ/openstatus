"use client";

import type {
  PublicMonitor,
  StatusReportWithUpdates,
} from "@openstatus/db/src/schema";
import { Separator } from "@openstatus/ui";

import { notEmpty } from "@/lib/utils";
import { StatusReport } from "./status-report";

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
        (update) => update.date.getTime() > filter?.date?.getTime(),
      );
    });
  }

  const reports = getFilteredReports().sort((a, b) => {
    if (a.updatedAt === undefined) return 1;
    if (b.updatedAt === undefined) return -1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <>
      {reports?.length > 0 ? (
        <div className="grid gap-8">
          {reports.map((report, i) => {
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
                {!isLast ? <Separator /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </>
  );
};

function EmptyState() {
  return (
    <p className="text-center font-light text-muted-foreground text-sm">
      No incident reported.
    </p>
  );
}
