"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import type {
  PublicMonitor,
  StatusReportWithUpdates,
} from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui/src/components/badge";

import { setPrefixUrl } from "@/app/status-page/[domain]/utils";
import { statusDict } from "@/data/incidents-dictionary";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";
import { DateTimeTooltip } from "./datetime-tooltip";
import { ProcessMessage } from "./process-message";

function StatusReport({
  report,
  monitors,
  actions,
  isDemo,
}: {
  report: StatusReportWithUpdates;
  monitors: PublicMonitor[];
  actions?: React.ReactNode;
  isDemo?: boolean;
}) {
  const params = useParams<{ domain: string }>();

  if (isDemo) {
    return (
      <div className="group grid gap-4 rounded-lg border border-transparent p-3 hover:border-border hover:bg-muted/20">
        <StatusReportHeader title={report.title} {...{ monitors, actions }} />
        <StatusReportUpdates updates={report.statusReportUpdates} />
      </div>
    );
  }

  return (
    <Link href={setPrefixUrl(`/events/report/${report.id}`, params)}>
      <div className="group grid gap-4 rounded-lg border border-transparent p-3 hover:border-border hover:bg-muted/20">
        <StatusReportHeader title={report.title} {...{ monitors, actions }} />
        <StatusReportUpdates updates={report.statusReportUpdates} />
      </div>
    </Link>
  );
}

// REMINDER: we had the report?.id in the link href to features page to be clickable
function StatusReportHeader({
  title,
  monitors,
  actions,
}: {
  title: StatusReportWithUpdates["title"];
  monitors: PublicMonitor[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-xl">{title}</h3>
        <ul className="flex flex-wrap gap-2">
          {monitors.map((monitor) => (
            <li key={monitor.id}>
              <Badge variant="secondary">{monitor.name}</Badge>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {/* NOT IDEAL BUT IT WORKS */}
        {actions ? (
          actions
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        )}
      </div>
    </div>
  );
}

interface StatusReportUpdatesProps {
  updates: {
    date?: Date;
    id: number;
    status:
      | "investigating"
      | "identified"
      | "monitoring"
      | "resolved"
      | "maintenance";
    message: string;
  }[];
}

function StatusReportUpdates({ updates }: StatusReportUpdatesProps) {
  return (
    <div className="grid gap-4">
      {updates.map((update, i) => {
        const { icon, label, color } = statusDict[update.status];
        const StatusIcon = Icons[icon];
        return (
          <div
            key={update.id}
            className={cn(
              "group -m-2 relative flex gap-4 border border-transparent p-2",
            )}
          >
            <div className="relative">
              <div
                className={cn(
                  "rounded-full border border-border bg-background p-2",
                  i === 0 ? color : null,
                )}
              >
                <StatusIcon className="h-4 w-4" />
              </div>
              {i !== updates.length - 1 ? (
                <div className="absolute inset-x-0 mx-auto h-full w-[2px] bg-muted" />
              ) : null}
            </div>
            <div className="mt-2 grid flex-1 gap-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{label}</p>
                {update.date ? (
                  <p className="mt-px text-muted-foreground text-xs">
                    <DateTimeTooltip date={new Date(update.date)} />
                  </p>
                ) : null}
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
