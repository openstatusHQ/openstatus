// TODO: create Compound Components like Tracker.Legend instead of passing props
import Link from "next/link";
import { cva } from "class-variance-authority";
import { formatDistance } from "date-fns";
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
      up: "bg-green-500",
      down: "bg-red-500",
      degraded: "bg-yellow-500",
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
    <div className="max-w-max">
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
        {slicedData
          .reverse()
          .map(({ count, ok, avgLatency, cronTimestamp }, i) => {
            const ratio = ok / count;
            const isOk = ratio === 1; // TODO: when operational, downtime, degraded
            return (
              <HoverCard key={i} openDelay={100} closeDelay={100}>
                <HoverCardTrigger>
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
                      {formatDistance(new Date(cronTimestamp), new Date(), {
                        addSuffix: true,
                        includeSeconds: true,
                      })}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {avgLatency}ms
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
      </div>
    </div>
  );
}
