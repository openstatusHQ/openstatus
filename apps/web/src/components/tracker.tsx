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
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// What would be cool is tracker that turn from green to red  depending on the number of errors
const tracker = cva("h-10 w-1.5 sm:w-2 rounded-full md:w-2.5", {
  variants: {
    variant: {
      up: "bg-green-500 data-[state=open]:bg-green-600",
      down: "bg-red-500 data-[state=open]:bg-red-600",
      degraded: "bg-yellow-500 data-[state=open]:bg-yellow-600",
      empty: "bg-muted-foreground/20",
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
  /**
   * Maximium length of the data array
   */
  maxSize?: number;
  context?: "play" | "status-page"; // TODO: we might need to extract those two different use cases - for now it's ok I'd say.
}

export function Tracker({
  data,
  url,
  id,
  name,
  maxSize = 35,
  context = "play",
  description,
}: TrackerProps) {
  const slicedData = data.slice(0, maxSize).reverse();
  const placeholderData: null[] = Array(maxSize).fill(null);

  const reducedData = slicedData.reduce(
    (prev, curr) => {
      prev.ok += curr.ok;
      prev.count += curr.count;
      return prev;
    },
    {
      count: 0,
      ok: 0,
    },
  );

  const uptime =
    reducedData.count !== 0
      ? `${((reducedData.ok / reducedData.count) * 100).toFixed(2)}% uptime`
      : "";

  return (
    <div className="mx-auto max-w-max">
      <div className="mb-1 flex justify-between text-sm sm:mb-2">
        <div className="flex items-center gap-2">
          <p className="text-foreground font-semibold">{name}</p>
          <MoreInfo {...{ url, id, context, description }} />
        </div>
        <p className="text-muted-foreground font-light">{uptime}</p>
      </div>
      <div className="relative">
        <div className="z-[-1] flex gap-0.5">
          {placeholderData.map((_, i) => {
            return <div key={i} className={tracker({ variant: "empty" })} />;
          })}
        </div>
        <div className="absolute right-0 top-0 flex gap-0.5">
          {slicedData.map((props) => {
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
  context,
}: Monitor & Pick<TrackerProps, "context">) => {
  const [open, setOpen] = React.useState(false);
  const ratio = ok / count;
  // FIX: this is an easy way to detect if cronTimestamps have been aggregated
  const isMidnight = String(cronTimestamp).endsWith("00000");
  const date = new Date(cronTimestamp);
  const toDate = isMidnight ? date.setDate(date.getDate() + 1) : cronTimestamp;
  const dateFormat = isMidnight ? "dd/MM/yy" : "dd/MM/yy HH:mm";

  return (
    <HoverCard
      openDelay={100}
      closeDelay={100}
      open={open}
      onOpenChange={setOpen}
    >
      <HoverCardTrigger onClick={() => setOpen(true)} asChild>
        <div className={tracker({ variant: getStatus(ratio).variant })} />
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-64">
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
              Total requests
            </span>
          </p>
          <p className="text-right text-xs">
            <span className="font-mono text-red-600">{count - ok}</span>{" "}
            <span className="text-muted-foreground font-light">
              Failed requests
            </span>
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

// FIXME this is a temporary solution
const getStatus = (
  ratio: number,
): { label: string; variant: "up" | "degraded" | "down" } => {
  if (ratio >= 0.98) return { label: "Operational", variant: "up" };
  if (ratio >= 0.5) return { label: "Degraded", variant: "degraded" };
  return { label: "Downtime", variant: "down" };
};
