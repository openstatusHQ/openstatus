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
        (update) => update.date.getTime() > filter?.date?.getTime()
      );
    });
  }

  const reports = getFilteredReports().sort((a, b) => {
    if (a.updatedAt === undefined || a.updatedAt === null) return 1;
    if (b?.updatedAt === undefined || b.updatedAt === null) return -1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  if (!reports.length) {
    return <EmptyState />;
  }

  return <div className="grid gap-8" />;
};

function EmptyState() {
  return (
    <p className="text-center font-light text-muted-foreground text-sm">
      No incident reported.
    </p>
  );
}
