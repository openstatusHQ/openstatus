"use client";

import * as React from "react";
import Link from "next/link";
import { cva } from "class-variance-authority";
import { endOfDay, format, formatDuration, startOfDay } from "date-fns";
import { ChevronRight, Info } from "lucide-react";

import type {
  Incident,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import type { Monitor } from "@openstatus/tinybird";
import { classNames, Tracker as OSTracker } from "@openstatus/tracker";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

const tracker = cva("h-10 rounded-full flex-1", {
  variants: {
    variant: {
      blacklist: "bg-green-500/80 data-[state=open]:bg-green-500",
      ...classNames,
    },
    report: {
      0: "",
      // IDEA: data-[state=open]:from-40% data-[state=open]:to-40%
      30: "bg-gradient-to-t from-blue-500/90 hover:from-blue-500 from-30% to-transparent to-30%",
    },
  },
  defaultVariants: {
    variant: "empty",
    report: 0,
  },
});

interface TrackerProps {
  data: Monitor[];
  name: string;
  description?: string;
  reports?: (StatusReport & { statusReportUpdates: StatusReportUpdate[] })[];
  incidents?: Incident[];
}

export function Tracker({
  data,
  name,
  description,
  reports,
  incidents,
}: TrackerProps) {
  const tracker = new OSTracker({ data, statusReports: reports, incidents });
  const uptime = tracker.totalUptime;
  const isMissing = tracker.isDataMissing;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <p className="text-foreground line-clamp-1 font-semibold">{name}</p>
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
          <p className="text-muted-foreground shrink-0 font-light">{uptime}%</p>
        ) : null}
      </div>
      <div className="relative h-full w-full">
        <div className="flex flex-row-reverse gap-px sm:gap-0.5">
          {tracker.days.map((props, i) => {
            return <Bar key={i} {...props} />;
          })}
        </div>
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-xs font-light">
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
    report: statusReports && statusReports.length > 0 ? 30 : undefined,
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
                  <p className="text-muted-foreground flex-shrink-0">
                    {format(new Date(day), "MMM d")}
                  </p>
                </div>
                <div className="text-muted-foreground flex justify-between gap-8 text-xs font-light">
                  <p>
                    <code className="text-green-500">{count}</code> requests
                  </p>
                  <p>
                    <code className="text-red-500">{count - ok}</code> failed
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
            href={`./incidents/${report.id}`}
            className="hover:text-foreground group flex items-center justify-between gap-2"
          >
            <span className="truncate">{report.title}</span>
            <ChevronRight className="h-4 w-4" />
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
      Down for{" "}
      {formatDuration(
        { minutes, hours, days },
        { format: ["days", "hours", "minutes", "seconds"], zero: false },
      )}
    </p>
  );
}
