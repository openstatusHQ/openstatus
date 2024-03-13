import type { Monitor } from "@openstatus/tinybird";
import { classNames, Tracker as OSTracker } from "@openstatus/tracker";

import { cn, formatDate } from "@/lib/utils";

export function Tracker({ data }: { data: Monitor[] }) {
  const tracker = new OSTracker({ data });

  return (
    <div tw="flex flex-col w-full my-12">
      <div tw="flex flex-col mx-auto">
        <div tw="flex flex-row items-center justify-between -mb-1 text-black font-light">
          <p></p>
          <p tw="font-medium">{tracker.totalUptime}%</p>
        </div>
        {/* Empty State */}
        <div tw="flex flex-row relative">
          {new Array(data.length).fill(null).map((_, i) => {
            return <div key={i} tw="h-16 w-3 rounded-full mr-1 bg-black/20" />;
          })}
          <div tw="flex flex-row-reverse absolute left-0">
            {tracker.days.map((item, i) => {
              const isBlackListed = Boolean(item.blacklist);
              if (isBlackListed) {
                return (
                  <div key={i} tw="h-16 w-3 rounded-full mr-1 bg-green-400" />
                );
              }
              return (
                <div
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
