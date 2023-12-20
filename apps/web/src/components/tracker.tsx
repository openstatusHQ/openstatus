"use client";

import * as React from "react";
import Link from "next/link";
import { cva } from "class-variance-authority";
import { format } from "date-fns";
import { ChevronRight, Eye, Info } from "lucide-react";

import type {
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

import useWindowSize from "@/hooks/use-window-size";
import {
  addBlackListInfo,
  getStatus,
  getTotalUptimeString,
} from "@/lib/tracker";

// What would be cool is tracker that turn from green to red  depending on the number of errors
const tracker = cva("h-10 rounded-full flex-1", {
  variants: {
    variant: {
      up: "bg-green-500/90 data-[state=open]:bg-green-500",
      down: "bg-red-500/90 data-[state=open]:bg-red-500",
      degraded: "bg-yellow-500/90 data-[state=open]:bg-yellow-500",
      empty: "bg-muted-foreground/20 data-[state=open]:bg-muted-foreground/30",
      blacklist: "bg-green-500/80 data-[state=open]:bg-green-500",
    },
    report: {
      0: "",
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
  url: string;
  id: string | number;
  name: string;
  description?: string;
  context?: "play" | "status-page"; // TODO: we might need to extract those two different use cases - for now it's ok I'd say.
  timezone?: string;
  reports?: (StatusReport & { statusReportUpdates: StatusReportUpdate[] })[];
}

export function Tracker({
  data,
  url,
  id,
  name,
  context = "status-page",
  description,
  reports,
}: TrackerProps) {
  const { isMobile } = useWindowSize();
  // TODO: it is better than how it was currently, but creates a small content shift on first render
  const maxSize = React.useMemo(() => (isMobile ? 35 : 45), [isMobile]);
  const uptime = getTotalUptimeString(data);

  const _data = addBlackListInfo(data);
  const _placeholder = Array.from({ length: maxSize - _data.length });

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <p className="text-foreground line-clamp-1 font-semibold">{name}</p>
          {description ? (
            <MoreInfo {...{ url, id, context, description }} />
          ) : null}
        </div>
        <p className="text-muted-foreground shrink-0 font-light">{uptime}</p>
      </div>
      <div className="relative h-full w-full">
        <div className="flex flex-row-reverse gap-0.5">
          {_data.map((props, i) => {
            const dateReports = reports?.filter((report) => {
              const firstStatusReportUpdate = report.statusReportUpdates.sort(
                (a, b) => a.date.getTime() - b.date.getTime(),
              )?.[0];

              if (!firstStatusReportUpdate) return false;
              const d = firstStatusReportUpdate.date;
              d.setHours(0, 0, 0); // set date to midnight as cronTimestamp is midnight
              return d.getTime() === new Date(props.day).getTime();
            });
            return (
              <Bar key={i} context={context} reports={dateReports} {...props} />
            );
          })}
          {_placeholder.map((_, i) => {
            return <div key={i} className={tracker({ variant: "empty" })} />;
          })}
        </div>
      </div>
    </div>
  );
}

const MoreInfo = ({
  url,
  id,
  context,
  description,
}: Pick<TrackerProps, "url" | "id" | "context" | "description">) => {
  const [open, setOpen] = React.useState(false);
  const formattedURL = new URL(url);
  const link = `${formattedURL.host}${formattedURL.pathname}`;

  if (description == null && context !== "play") {
    return;
  }

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger onClick={() => setOpen(true)} asChild>
          <Info className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-muted-foreground">
            {context === "play" ? (
              <Link href={`/monitor/${id}`} className="hover:text-foreground">
                {link}
              </Link>
            ) : (
              description
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

type BarProps = Monitor & { blacklist?: string } & Pick<
    TrackerProps,
    "context" | "reports"
  >;

const Bar = ({
  count,
  ok,
  avgLatency,
  day,
  blacklist,
  context,
  reports,
}: BarProps) => {
  const [open, setOpen] = React.useState(false);
  const ratio = ok / count;
  const cronTimestamp = new Date(day).getTime();
  const date = new Date(cronTimestamp);
  const toDate = date.setDate(date.getDate() + 1);
  const dateFormat = "dd/MM/yy";

  const className = tracker({
    report: reports && reports.length > 0 ? 30 : undefined,
    variant: blacklist ? "blacklist" : getStatus(ratio).variant,
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
      <HoverCardContent side="top" className="w-64">
        {blacklist ? (
          <p className="text-muted-foreground text-xs">{blacklist}</p>
        ) : (
          <>
            <div className="flex justify-between">
              <p className="text-sm font-semibold">{getStatus(ratio).label}</p>
              {context === "play" ? (
                <Link
                  href={`/monitor/1?fromDate=${cronTimestamp}&toDate=${toDate}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
            <ul className="my-1.5">
              {reports?.map((report) => (
                <li key={report.id} className="text-muted-foreground text-sm">
                  <Link
                    href={`./incidents/${report.id}`}
                    className="hover:text-foreground group flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{report.title}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex justify-between">
              <p className="text-xs font-light">
                {format(new Date(cronTimestamp), dateFormat)}
              </p>
              <p className="text-muted-foreground text-xs">
                avg. <span className="font-mono">{avgLatency}ms</span>
              </p>
            </div>
            <Separator className="my-1.5" />
            <div className="grid grid-cols-2">
              <p className="text-left text-xs">
                <span className="font-mono text-green-600">{count}</span>{" "}
                <span className="text-muted-foreground font-light">
                  total requests
                </span>
              </p>
              <p className="text-right text-xs">
                <span className="font-mono text-red-600">{count - ok}</span>{" "}
                <span className="text-muted-foreground font-light">
                  failed requests
                </span>
              </p>
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
