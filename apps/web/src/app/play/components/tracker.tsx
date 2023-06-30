// TODO: change file location or naming
// TODO: create Compound Components like Tracker.Legend instead of passing props
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const trackerColors = {
  up: "bg-green-500",
  down: "bg-red-500",
  degraded: "bg-yellow-500",
  empty: "bg-muted-foreground",
};

type TrackerColor = keyof typeof trackerColors;

interface TrackerProps<T extends { color: TrackerColor }> {
  data: T[];
  /**
   * data key that's value is the tooltip
   */
  tooltipKey: keyof T;
  /**
   * Maximium length of the data array
   */
  maxSize?: number;
}

export function Tracker<T extends { color: TrackerColor }>({
  data,
  tooltipKey,
  maxSize = 35,
}: TrackerProps<T>) {
  const sliceData = data
    .slice() // needed to make the array immutable
    .reverse()
    .slice(0, maxSize);

  const placeholder = Array(Math.max(0, maxSize - sliceData.length))
    .fill(null)
    .map((_) => ({
      [tooltipKey]: "Missing",
      color: "empty",
    })) as T[];

  return (
    <div className="max-w-max">
      <div className="flex justify-between">
        <p className="text-foreground">Status</p>
        <p className="text-muted-foreground mb-3 text-sm">
          <Link
            href={`/monitor/openstatus.dev`}
            className="hover:text-foreground font-semibold"
          >
            openstatus.dev
          </Link>
          <span className="text-muted-foreground/70 mx-1">&bull;</span>
          last {maxSize} pings
        </p>
      </div>
      <div className="flex gap-0.5">
        {[...placeholder, ...sliceData].map((t, i) => {
          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* use button to open modal */}
                  <div
                    className={cn(
                      "h-10 w-2.5 rounded-full",
                      trackerColors[t.color],
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t[tooltipKey]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
