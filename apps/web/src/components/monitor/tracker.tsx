"use client";

import * as React from "react";
import Link from "next/link";
import { cva } from "class-variance-authority";
import { format } from "date-fns";
import { Eye } from "lucide-react";

import type { Monitor } from "@openstatus/tinybird";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
  /**
   * Maximium length of the data array
   */
  maxSize?: number;
}

// TODO: instead of slicing and setting placeholder data,
// just start from end and absolute position the same number of divs
// with a lighter bg color
export function Tracker({ data, maxSize = 35 }: TrackerProps) {
  const slicedData = data.slice(0, maxSize);
  const placeholderData: null[] = Array(
    Math.max(0, maxSize - slicedData.length),
  ).fill(null);

  return (
    <div className="mx-auto max-w-max">
      <div className="flex justify-end">
        <p className="text-muted-foreground mb-2 text-sm">
          <Link
            href={`/monitor/openstatus`}
            className="hover:text-foreground font-semibold"
          >
            openstatus.dev
          </Link>
          <span className="text-muted-foreground/70 mx-1">&bull;</span>
          <span className="font-light">last {maxSize} pings</span>
        </p>
      </div>
      <div className="flex gap-0.5">
        {placeholderData.map((_, i) => {
          return <div key={i} className={tracker({ variant: "empty" })} />;
        })}
        {slicedData.reverse().map((props) => {
          return <Bar key={props.cronTimestamp} {...props} />;
        })}
      </div>
    </div>
  );
}

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
