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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  id: string;
  name: string;
  /**
   * Maximium length of the data array
   */
  maxSize?: number;
}

// TODO: discusss to move data fetching inside of Tracker
export function Tracker({ data, url, id, name, maxSize = 35 }: TrackerProps) {
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

  const totalUptime = ((reducedData.ok / reducedData.count) * 100).toFixed(2);

  return (
    <div className="mx-auto max-w-max">
      <div className="mb-1 flex justify-between text-sm sm:mb-2">
        <div className="flex items-center gap-2">
          <p className="text-foreground font-semibold">{name}</p>
          <MoreInfo {...{ url, id }} />
        </div>
        <p className="text-muted-foreground font-light">
          {`${totalUptime}%`} uptime
        </p>
      </div>
      <div className="relative">
        <div className="z-[-1] flex gap-0.5">
          {placeholderData.map((_, i) => {
            return <div key={i} className={tracker({ variant: "empty" })} />;
          })}
        </div>
        <div className="absolute right-0 top-0 flex gap-0.5">
          {slicedData.map((props) => {
            return <Bar key={props.cronTimestamp} {...props} />;
          })}
        </div>
      </div>
    </div>
  );
}

const MoreInfo = ({ url, id }: Record<"id" | "url", string>) => {
  const [open, setOpen] = React.useState(false);
  const formattedURL = new URL(url);
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger onClick={() => setOpen(true)}>
          <Info className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>
          <Link
            href={`/monitor/${id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {`${formattedURL.host}${formattedURL.pathname}`}
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const Bar = ({ count, ok, avgLatency, cronTimestamp }: Monitor) => {
  const [open, setOpen] = React.useState(false);
  const ratio = ok / count;
  const isOk = ratio === 1; // TODO: when operational, downtime, degraded

  return (
    <HoverCard
      openDelay={100}
      closeDelay={100}
      open={open}
      onOpenChange={setOpen}
    >
      <HoverCardTrigger onClick={() => setOpen(true)} asChild>
        <div className={tracker({ variant: isOk ? "up" : "down" })} />
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-56">
        <div className="flex justify-between">
          <p className="text-sm font-semibold">
            {isOk ? "Operational" : "Downtime"}
          </p>
          <Link
            href={`/monitor/openstatus?cronTimestamp=${cronTimestamp}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex justify-between">
          <p className="text-xs font-light">
            {format(new Date(cronTimestamp), "dd/MM/yy HH:mm")}
          </p>
          <p className="text-muted-foreground text-xs">
            avg. <span className="font-mono">{avgLatency}ms</span>
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
