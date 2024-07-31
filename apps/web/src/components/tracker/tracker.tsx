"use client";

import { cva } from "class-variance-authority";
import { format, formatDuration } from "date-fns";
import { ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type {
  Incident,
  Maintenance,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import type { Monitor } from "@openstatus/tinybird";
import {
  Tracker as OSTracker,
  classNames,
  endOfDay,
  startOfDay,
} from "@openstatus/tracker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/src/components/hover-card";
import { Separator } from "@openstatus/ui/src/components/separator";

const tracker = cva("h-10 rounded-full flex-1", {
  variants: {
    variant: {
      blacklist:
        "bg-status-operational/80 data-[state=open]:bg-status-operational",
      ...classNames,
    },
    report: {
      false: "",
      true: classNames.degraded,
    },
  },
  defaultVariants: {
    variant: "empty",
    report: false,
  },
});

interface TrackerProps {
  data: Monitor[];
  name: string;
  description?: string;
  reports?: (StatusReport & { statusReportUpdates: StatusReportUpdate[] })[];
  incidents?: Incident[];
  maintenances?: Maintenance[];
}

export function Tracker({
  data,
  name,
  description,
  reports,
  incidents,
  maintenances,
}: TrackerProps) {
  const tracker = new OSTracker({
    data,
    statusReports: reports,
    incidents,
    maintenances,
  });
  const uptime = tracker.totalUptime;
  const isMissing = tracker.isDataMissing;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <p className="line-clamp-1 font-semibold text-foreground">{name}</p>
          {description ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-muted-foreground">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {!isMissing ? (
          <p className="shrink-0 font-light text-muted-foreground">{uptime}%</p>
        ) : null}
      </div>
      <div className="relative h-full w-full">
        <div className="flex flex-row-reverse gap-px sm:gap-0.5">
          {tracker.days.map((props) => {
            return <Bar key={`tracker-${nanoid(6)}`} {...props} />;
          })}
        </div>
      </div>
      <div className="flex items-center justify-between font-light text-muted-foreground text-xs">
        <p>{tracker.days.length} days ago</p>
        <p>Today</p>
      </div>
    </div>
  );
}

type BarProps = OSTracker["days"][number] & {
  className?: string;
};

export const Bar = ({
  count,
  ok,
  day,
  variant,
  label,
  blacklist,
  statusReports,
  incidents,
  className,
}: BarProps) => {
  const [open, setOpen] = React.useState(false);

  const rootClassName = tracker({
    report: statusReports.length > 0,
    variant: blacklist ? "blacklist" : variant,
  });

  return (
    <HoverCard
      openDelay={100}
      closeDelay={100}
      open={open}
      onOpenChange={setOpen}
    >
      <HoverCardTrigger onClick={() => setOpen(true)} asChild>
        <div className={cn(rootClassName, className)} />
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-auto max-w-[16rem] p-2">
        {blacklist ? (
          <p className="text-muted-foreground text-sm">{blacklist}</p>
        ) : (
          <div>
            <div className="flex gap-2">
              <div
                className={cn(
                  rootClassName,
                  "h-auto w-1 flex-none rounded-full",
                )}
              />
              <div className="grid flex-1 gap-1">
                <div className="flex justify-between gap-8 text-sm">
                  <p className="font-semibold">{label}</p>
                  <p className="flex-shrink-0 text-muted-foreground">
                    {format(new Date(day), "MMM d")}
                  </p>
                </div>
                <div className="flex justify-between gap-8 font-light text-muted-foreground text-xs">
                  <p>
                    <code className="text-status-operational">{count}</code>{" "}
                    requests
                  </p>
                  <p>
                    <code className="text-status-down">{count - ok}</code>{" "}
                    failed
                  </p>
                </div>
              </div>
            </div>
            {statusReports && statusReports.length > 0 ? (
              <>
                <Separator className="my-1.5" />
                <StatusReportList reports={statusReports} />
              </>
            ) : null}
            {incidents && incidents.length > 0 ? (
              <>
                <Separator className="my-1.5" />
                <DowntimeText incidents={incidents} day={day} />
              </>
            ) : null}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export function StatusReportList({ reports }: { reports: StatusReport[] }) {
  return (
    <ul>
      {reports?.map((report) => (
        <li key={report.id} className="text-muted-foreground text-sm">
          <Link
            // TODO: include setPrefixUrl for local development
            href={`./events/report/${report.id}`}
            className="group flex items-center justify-between gap-2 hover:text-foreground"
          >
            <span className="truncate">{report.title}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DowntimeText({
  incidents,
  day,
}: {
  incidents: Incident[];
  day: string; // TODO: use Date
}) {
  // TODO: MOVE INTO TRACKER CLASS?
  const startOfDayDate = startOfDay(new Date(day));
  const endOfDayDate = endOfDay(new Date(day));

  const incidentLength = incidents
    ?.map((incident) => {
      const { startedAt, resolvedAt } = incident;
      if (!startedAt) return 0;
      if (!resolvedAt)
        return (
          Math.min(endOfDayDate.getTime(), new Date().getTime()) -
          Math.max(startOfDayDate.getTime(), startedAt.getTime())
        );
      return (
        Math.min(resolvedAt.getTime(), endOfDayDate.getTime()) -
        Math.max(startOfDayDate.getTime(), startedAt.getTime())
      );
    })
    // add 1 second because end of day is 23:59:59
    .reduce((acc, curr) => acc + 1 + curr, 0);

  const days = Math.floor(incidentLength / (1000 * 60 * 60 * 24));
  const minutes = Math.floor((incidentLength / (1000 * 60)) % 60);
  const hours = Math.floor((incidentLength / (1000 * 60 * 60)) % 24);

  return (
    <p className="text-muted-foreground text-xs">
      Downtime for{" "}
      {formatDuration(
        { minutes, hours, days },
        { format: ["days", "hours", "minutes", "seconds"], zero: false },
      )}
    </p>
  );
}
