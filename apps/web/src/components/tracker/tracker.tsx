"use client";

import * as React from "react";
import Link from "next/link";
import { cva } from "class-variance-authority";
import { endOfDay, format, formatDuration, startOfDay } from "date-fns";
import { ChevronRight, Info } from "lucide-react";
import type { z } from "zod";

import type {
  selectIncidentPageSchema,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import type { Monitor } from "@openstatus/tinybird";
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

import {
  addBlackListInfo,
  areDatesEqualByDayMonthYear,
  getStatusByRatio,
  getTotalUptimeString,
  incidentStatus,
} from "@/lib/tracker";
import { cn } from "@/lib/utils";

// What would be cool is tracker that turn from green to red  depending on the number of errors
const tracker = cva("h-10 rounded-full flex-1", {
  variants: {
    variant: {
      up: "bg-green-500/90 data-[state=open]:bg-green-500",
      down: "bg-rose-500/90 data-[state=open]:bg-rose-500",
      degraded: "bg-amber-500/90 data-[state=open]:bg-amber-500",
      empty: "bg-muted-foreground/20 data-[state=open]:bg-muted-foreground/30",
      blacklist: "bg-green-500/80 data-[state=open]:bg-green-500",
      incident: "bg-rose-500/90 data-[state=open]:bg-rose-500",
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

// FIXME:
type Incidents = z.infer<typeof selectIncidentPageSchema>;

interface TrackerProps {
  data: Monitor[];
  name: string;
  description?: string;
  reports?: (StatusReport & { statusReportUpdates: StatusReportUpdate[] })[];
  incidents?: Incidents;
}

export function Tracker({
  data,
  name,
  description,
  reports,
  incidents,
}: TrackerProps) {
  const uptime = getTotalUptimeString(data);
  const _data = addBlackListInfo(data);

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
        <p className="text-muted-foreground shrink-0 font-light">{uptime}</p>
      </div>
      <div className="relative h-full w-full">
        <div className="flex flex-row-reverse gap-px sm:gap-0.5">
          {_data.map((props, i) => {
            const dateReports = reports?.filter((report) => {
              const firstStatusReportUpdate = report.statusReportUpdates.sort(
                (a, b) => a.date.getTime() - b.date.getTime(),
              )?.[0];

              if (!firstStatusReportUpdate) return false;

              return areDatesEqualByDayMonthYear(
                firstStatusReportUpdate.date,
                new Date(props.day),
              );
            });

            const dateIncidents = incidents?.filter((incident) => {
              const { startedAt, resolvedAt } = incident;
              const day = new Date(props.day);
              const eod = endOfDay(day);
              const sod = startOfDay(day);

              if (!startedAt) return false; // not started
              if (!resolvedAt) return true; // still ongoing

              const hasResolvedBeforeStartOfDay =
                resolvedAt.getTime() <= sod.getTime();

              if (hasResolvedBeforeStartOfDay) return false;

              const hasStartedBeforeEndOfDay =
                startedAt.getTime() <= eod.getTime();

              const hasResolvedBeforeEndOfDay =
                resolvedAt.getTime() <= eod.getTime();

              if (hasStartedBeforeEndOfDay || hasResolvedBeforeEndOfDay)
                return true;

              if (hasResolvedBeforeEndOfDay) return true;

              return false;
            });

            return (
              <Bar
                key={i}
                reports={dateReports}
                incidents={dateIncidents}
                {...props}
              />
            );
          })}
        </div>
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-xs font-light">
        <p>{_data.length - 1} days ago</p>
        <p>Today</p>
      </div>
    </div>
  );
}

type BarProps = Monitor & { blacklist?: string } & Pick<
    TrackerProps,
    "reports" | "incidents"
  >;

const Bar = ({ count, ok, day, blacklist, reports, incidents }: BarProps) => {
  const [open, setOpen] = React.useState(false);
  const status = getStatusByRatio(ok / count);
  const isIncident = incidents && incidents.length > 0;

  const { label, variant } = isIncident ? incidentStatus : status;

  const className = tracker({
    report: reports && reports.length > 0 ? 30 : undefined,
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
        <div className={className} />
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-auto max-w-[16rem] p-2">
        {blacklist ? (
          <p className="text-muted-foreground text-sm">{blacklist}</p>
        ) : (
          <div>
            <div className="flex gap-2">
              <div
                className={cn(className, "h-auto w-1 flex-none rounded-full")}
              />
              <div className="grid flex-1 gap-1">
                <div className="flex justify-between gap-8 text-sm">
                  <p className="font-semibold">{label}</p>
                  <p className="text-muted-foreground">
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
            {reports && reports.length > 0 ? (
              <>
                <Separator className="my-1.5" />
                <StatusReportList reports={reports} />
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
  incidents: Incidents;
  day: string; // TODO: use Date
}) {
  const startOfDayDate = startOfDay(new Date(day));
  const endOfDayDate = endOfDay(new Date(day));

  const incidentLength =
    Math.max(
      ...incidents?.map((incident) => {
        const { startedAt, resolvedAt } = incident;
        if (!startedAt) return 0;
        if (!resolvedAt)
          return (
            endOfDayDate.getTime() -
            Math.max(startOfDayDate.getTime(), startedAt.getTime())
          );
        return (
          Math.min(resolvedAt.getTime(), endOfDayDate.getTime()) -
          Math.max(startOfDayDate.getTime(), startedAt.getTime())
        );
      }),
    ) + 1;

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
