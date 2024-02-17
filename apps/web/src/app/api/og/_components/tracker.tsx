import type { Monitor } from "@openstatus/tinybird";

import {
  addBlackListInfo,
  getStatusByRatio,
  getTotalUptimeString,
} from "@/lib/tracker";
import { cn, formatDate } from "@/lib/utils";

export function Tracker({ data }: { data: Monitor[] }) {
  const _data = addBlackListInfo(data);
  const uptime = getTotalUptimeString(data);

  return (
    <div tw="flex flex-col w-full my-12">
      <div tw="flex flex-col mx-auto">
        <div tw="flex flex-row items-center justify-between -mb-1 text-black font-light">
          <p></p>
          <p tw="font-medium">{uptime}</p>
        </div>
        {/* Empty State */}
        <div tw="flex flex-row relative">
          {new Array(data.length).fill(null).map((_, i) => {
            return <div key={i} tw="h-16 w-3 rounded-full mr-1 bg-black/20" />;
          })}
          <div tw="flex flex-row-reverse absolute left-0">
            {_data.map((item, i) => {
              const { variant } = getStatusByRatio(item.ok / item.count);
              const isBlackListed = Boolean(item.blacklist);
              if (isBlackListed) {
                return (
                  <div key={i} tw="h-16 w-3 rounded-full mr-1 bg-green-400" />
                );
              }
              return (
                <div
                  key={i}
                  tw={cn("h-16 w-3 rounded-full mr-1", {
                    "bg-green-500": variant === "up",
                    "bg-red-500": variant === "down",
                    "bg-amber-500": variant === "degraded",
                  })}
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
