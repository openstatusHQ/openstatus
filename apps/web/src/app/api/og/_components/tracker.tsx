import type { Monitor } from "@openstatus/tinybird";
import { Tracker as OSTracker, classNames } from "@openstatus/tracker";

import { cn, formatDate } from "@/lib/utils";
import { nanoid } from "nanoid";

export function Tracker({ data }: { data: Monitor[] }) {
  const tracker = new OSTracker({ data });

  return (
    <div tw="flex flex-col w-full my-12">
      <div tw="flex flex-col mx-auto">
        <div tw="flex flex-row items-center justify-between -mb-1 text-black font-light">
          <p tw="font-medium">{tracker.totalUptime}%</p>
        </div>
        {/* Empty State */}
        <div tw="flex flex-row relative">
          {new Array(data.length).fill(null).map((_) => {
            return (
              <div
                key={`placeholder-${nanoid(6)}`}
                tw="h-16 w-3 rounded-full mr-1 bg-black/20"
              />
            );
          })}
          <div tw="flex flex-row-reverse absolute left-0">
            {tracker.days.map((item, _i) => {
              const isBlackListed = Boolean(item.blacklist);
              if (isBlackListed) {
                return (
                  <div
                    key={`day-${item?.day}-${nanoid(6)}`}
                    tw="h-16 w-3 rounded-full mr-1 bg-status-operational/90"
                  />
                );
              }
              return (
                <div
                  key={`day-${item?.day}-${nanoid(6)}`}
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
