"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment } from "react";

import type {
  PublicMonitor,
  StatusReportWithUpdates,
} from "@openstatus/db/src/schema";
import { Badge, Button } from "@openstatus/ui";

import { setPrefixUrl } from "@/app/status-page/[domain]/utils";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../status-update/status-badge";
import { ProcessMessage } from "./process-message";
import { DateTimeTooltip } from "./datetime-tooltip";
import { format } from "date-fns";

function StatusReport({
  report,
  monitors,
}: {
  report: StatusReportWithUpdates;
  monitors: PublicMonitor[];
}) {
  return (
    <div className="group grid gap-4">
      <div className="grid gap-1">
        <StatusReportHeader {...{ report }} />
        <StatusReportDescription {...{ report, monitors }} />
      </div>
      <StatusReportUpdates {...{ report }} />
    </div>
  );
}

function StatusReportHeader({ report }: { report: StatusReportWithUpdates }) {
  const params = useParams<{ domain: string }>();
  return (
    <div className="flex items-center gap-2">
      <h3 className="font-semibold text-xl">{report.title}</h3>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground/50 group-hover:text-foreground"
        asChild
      >
        <Link href={setPrefixUrl(`/incidents/${report.id}`, params)}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function StatusReportDescription({
  report,
  monitors,
  className,
}: {
  report: StatusReportWithUpdates;
  monitors: PublicMonitor[];
  className?: string;
}) {
  const firstReport =
    report.statusReportUpdates[report.statusReportUpdates.length - 1];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <p className="text-muted-foreground text-sm" suppressHydrationWarning>
        Started at {format(firstReport.date, "LLL dd, y HH:mm (z)")}
      </p>
      <span className="text-muted-foreground/50 text-xs">•</span>
      <StatusBadge status={report.status} />
      {monitors.length > 0 ? (
        <>
          <span className="text-muted-foreground/50 text-xs">•</span>
          {monitors.map((monitor) => (
            <Badge key={monitor.id} variant="secondary">
              {monitor.name}
            </Badge>
          ))}
        </>
      ) : null}
    </div>
  );
}

// reports are already `orderBy: desc(report.date)` within the query itself
function StatusReportUpdates({ report }: { report: StatusReportWithUpdates }) {
  return (
    <div className="grid gap-2 md:grid-cols-10 md:gap-4">
      {report.statusReportUpdates.map((update) => {
        return (
          <Fragment key={update.id}>
            <div className="flex items-center gap-2 md:col-span-3 md:flex-col md:items-start md:gap-1">
              <p className="font-medium capitalize">{update.status}</p>
              <p
                className="font-mono text-muted-foreground text-sm md:text-xs"
                suppressHydrationWarning
              >
                {format(update.date, "LLL dd, y HH:mm (z)")}
              </p>
            </div>
            <div className="prose dark:prose-invert md:col-span-7">
              <ProcessMessage value={update.message} />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

StatusReport.Header = StatusReportHeader;
StatusReport.Description = StatusReportDescription;
StatusReport.Updates = StatusReportUpdates;

export {
  StatusReport,
  StatusReportDescription,
  StatusReportHeader,
  StatusReportUpdates,
};
