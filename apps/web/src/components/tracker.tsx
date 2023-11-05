"use client";

import * as React from "react";
import Link from "next/link";
import { cva } from "class-variance-authority";
import { format } from "date-fns";
import { Eye, Info } from "lucide-react";

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
import type { CleanMonitor } from "@/lib/tracker";
import { blacklistDates, cleanData, getStatus } from "@/lib/tracker";

// What would be cool is tracker that turn from green to red  depending on the number of errors
const tracker = cva("h-10 rounded-full flex-1", {
  variants: {
    variant: {
      up: "bg-green-500 data-[state=open]:bg-green-600",
      down: "bg-red-500 data-[state=open]:bg-red-600",
      degraded: "bg-yellow-500 data-[state=open]:bg-yellow-600",
      empty: "bg-muted-foreground/20 data-[state=open]:bg-muted-foreground/30",
      blacklist: "bg-green-400 data-[state=open]:bg-green-600",
    },
  },
  defaultVariants: {
    variant: "empty",
  },
});

interface TrackerProps {
  data: Monitor[];
  url: string;
  id: string | number;
  name: string;
  description?: string;
  context?: "play" | "status-page"; // TODO: we might need to extract those two different use cases - for now it's ok I'd say.
}

export function Tracker({
  data,
  url,
  id,
  name,
  context = "play",
  description,
}: TrackerProps) {
  const { isMobile } = useWindowSize();
  // TODO: it is better than how it was currently, but creates a small content shift on first render
  const maxSize = React.useMemo(() => (isMobile ? 35 : 45), [isMobile]);
  const { bars, uptime } = cleanData({ data, last: maxSize });

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
          {bars.map((props) => {
            return (
              <Bar key={props.cronTimestamp} context={context} {...props} />
            );
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

const Bar = ({
  count,
  ok,
  avgLatency,
  cronTimestamp,
  blacklist,
  context,
}: CleanMonitor & Pick<TrackerProps, "context">) => {
  const [open, setOpen] = React.useState(false);
  const ratio = ok / count;
  const date = new Date(cronTimestamp);
  const toDate = date.setDate(date.getDate() + 1);
  const dateFormat = "dd/MM/yy";

  return (
    <HoverCard
      openDelay={100}
      closeDelay={100}
      open={open}
      onOpenChange={setOpen}
    >
      <HoverCardTrigger onClick={() => setOpen(true)} asChild>
        <div
          className={tracker({
            variant: blacklist ? "blacklist" : getStatus(ratio).variant,
          })}
        />
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
                  href={`/monitor/openstatusPing?fromDate=${cronTimestamp}&toDate=${toDate}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
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
