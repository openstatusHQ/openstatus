import { Tracker as OSTracker, classNames } from "@openstatus/tracker";

import type { ResponseStatusTracker } from "@/lib/tb";
import { cn, formatDate } from "@/lib/utils";

interface TrackerProps {
  data: ResponseStatusTracker[];
}

export function Tracker({ data }: TrackerProps) {
  const tracker = new OSTracker({ data });

  return (
    <div tw="flex flex-col w-full my-12">
      <div tw="flex flex-col mx-auto">
        <div tw="flex flex-row items-center justify-between -mb-1 text-black font-light">
          <p tw="font-medium">{tracker.totalUptime}%</p>
        </div>
        {/* Empty State */}
        <div tw="flex flex-row relative">
          {new Array(data.length).fill(null).map((_, i) => {
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            return <div key={i} tw="h-16 w-3 rounded-full mr-1 bg-black/20" />;
          })}
          <div tw="flex flex-row-reverse absolute left-0">
            {tracker.days.map((item, i) => {
              const isBlackListed = Boolean(item.blacklist);
              if (isBlackListed) {
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                    key={i}
                    tw="h-16 w-3 rounded-full mr-1 bg-status-operational/90"
                  />
                );
              }
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  key={i}
                  tw={cn(
                    "h-16 w-3 rounded-full mr-1",
                    classNames[item.variant],
                  )}
                />
              );
            })}
          </div>
        </div>
        <div tw="flex flex-row items-center justify-between -mt-3 text-slate-500 text-sm">
          <p tw="">{data.length} days ago</p>
          <p tw="mr-1">{formatDate(new Date())}</p>
        </div>
      </div>
    </div>
  );
}
