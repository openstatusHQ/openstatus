// TODO: change file location or naming
// TODO: create Compound Components like Tracker.Legend instead of passing props
import Link from "next/link";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Ping } from "./schema";

const tracker = cva("h-10 w-2 rounded-full sm:w-2.5", {
  variants: {
    variant: {
      up: "bg-green-500",
      down: "bg-red-500",
      degraded: "bg-yellow-500",
      empty: "bg-muted-foreground",
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
  const sliceData = data
    .slice() // needed to make the array immutable
    .reverse()
    .slice(0, maxSize);

  const placeholderData: null[] = Array(
    Math.max(0, maxSize - sliceData.length),
  ).fill(null);

  const trackerData = [...placeholderData, ...sliceData].map((item) => {
    if (item === null) {
      return { tooltip: "Missing" };
    }
    const isOk = item.statusCode === 200;
    return {
      variant: isOk ? "up" : "down",
      tooltip: isOk ? "Operational" : "Downtime",
    };
  }) as (VariantProps<typeof tracker> & { tooltip?: string })[];

  return (
    <div className="max-w-max">
      <div className="flex justify-end">
        <p className="text-muted-foreground mb-3 text-sm">
          <Link
            href={`/monitor/openstatus`}
            className="hover:text-foreground font-semibold"
          >
            openstatus.dev
          </Link>
          <span className="text-muted-foreground/70 mx-1">&bull;</span>
          last {maxSize} pings
        </p>
      </div>
      <div className="flex gap-0.5">
        {trackerData.map(({ variant, tooltip }, i) => {
          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={tracker({ variant })} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
