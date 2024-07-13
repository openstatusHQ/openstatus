"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import type {
  PublicMonitor,
  StatusReportWithUpdates,
} from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { setPrefixUrl } from "@/app/status-page/[domain]/utils";
import { cn } from "@/lib/utils";
import { ProcessMessage } from "./process-message";
import { statusDict } from "@/data/incidents-dictionary";
import { Icons } from "../icons";
import { format } from "date-fns";

function StatusReport({
  report,
  monitors,
  actions,
}: {
  report: StatusReportWithUpdates;
  monitors: PublicMonitor[];
  actions?: React.ReactNode;
}) {
  const params = useParams<{ domain: string }>();
  return (
    <Link href={setPrefixUrl(`/incidents/${report.id}`, params)}>
      <div className="group grid gap-4 rounded-lg border border-transparent p-3 hover:border-border hover:bg-muted/20">
        <StatusReportHeader {...{ report, monitors, actions }} />
        <StatusReportUpdates {...{ report }} />
      </div>
    </Link>
  );
}

// REMINDER: we had the report?.id in the link href to features page to be clickable
function StatusReportHeader({
  report,
  monitors,
  actions,
}: {
  report: StatusReportWithUpdates;
  monitors: PublicMonitor[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-xl">{report.title}</h3>
        <ul className="flex gap-2">
          {monitors.map((monitor) => (
            <li key={monitor.id}>
              <Badge variant="secondary">{monitor.name}</Badge>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      </div>
    </div>
  );
}

function StatusReportUpdates({ report }: { report: StatusReportWithUpdates }) {
  return (
    <div className="grid gap-4">
      {report.statusReportUpdates.map((update, i) => {
        const { icon, label, color } = statusDict[update.status];
        const StatusIcon = Icons[icon];
        return (
          <div
            key={update.id}
            className={cn(
              "group -m-2 relative flex gap-4 border border-transparent p-2"
            )}
          >
            <div className="relative">
              <div
                className={cn(
                  "rounded-full border border-border bg-background p-2",
                  i === 0 ? color : null
                )}
              >
                <StatusIcon className="h-4 w-4" />
              </div>
              {i !== report.statusReportUpdates.length - 1 ? (
                <div className="absolute inset-x-0 mx-auto h-full w-[2px] bg-muted" />
              ) : null}
            </div>
            <div className="mt-2 grid flex-1 gap-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{label}</p>
                <p className="mt-px text-muted-foreground text-xs">
                  <code>
                    {format(new Date(update.date), "LLL dd, y HH:mm")}
                  </code>
                </p>
              </div>
              <div className="prose dark:prose-invert">
                <ProcessMessage value={update.message} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

StatusReport.Header = StatusReportHeader;
StatusReport.Updates = StatusReportUpdates;

export { StatusReport, StatusReportHeader, StatusReportUpdates };
