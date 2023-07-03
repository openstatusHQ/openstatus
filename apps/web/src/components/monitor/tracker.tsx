// TODO: change file location or naming
// TODO: create Compound Components like Tracker.Legend instead of passing props
import Link from "next/link";
import { cva } from "class-variance-authority";
import { formatDistance } from "date-fns";

import type { Ping } from "@openstatus/tinybird";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const tracker = cva("h-10 w-2 rounded-full sm:w-2.5", {
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
  data: Ping[];
  /**
   * Maximium length of the data array
   */
  maxSize?: number;
}

export function Tracker({ data, maxSize = 35 }: TrackerProps) {
  const sliceData = data.slice(0, maxSize);
  const placeholderData: null[] = Array(
    Math.max(0, maxSize - sliceData.length),
  ).fill(null);

  // TODO: use tinybird for data aggregation
  // IDEA: We want to group X events and aggregate data,
  // only on hover you will get the individual informations

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
        {sliceData
          .reverse()
          .map(({ statusCode, latency, timestamp, region }, i) => {
            const isOk = statusCode === 200;
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
                    <p className="text-muted-foreground font-mono text-xs">
                      {region}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs font-light">
                      {formatDistance(new Date(timestamp), new Date(), {
                        addSuffix: true,
                        includeSeconds: true,
                      })}
                    </p>
                    <p className="text-muted-foreground text-xs">{latency}ms</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
      </div>
    </div>
  );
}
