import {
  Status,
  calculateUptime,
  deriveUptimeStatus,
} from "@openstatus/services/status-page";

import type { ResponseStatusTracker } from "../../../../lib/tb";
import { cn, formatDate } from "../../../../lib/utils";
import { classNames, isInBlacklist, statusDetails } from "./status-config";

interface TrackerProps {
  data: ResponseStatusTracker[];
}

export function Tracker({ data }: TrackerProps) {
  const totalUptime = calculateUptime(data);
  const days = data.map((props) => {
    // a day with no checks is unknown (grey), not 100% uptime
    const status =
      props.count === 0 ? Status.Unknown : deriveUptimeStatus([props]);
    return {
      blacklist: isInBlacklist(new Date(props.day)),
      variant: statusDetails[status].variant,
    };
  });

  return (
    <div tw="flex flex-col w-full my-12">
      <div tw="flex flex-col mx-auto">
        <div tw="flex flex-row items-center justify-between -mb-1 text-black font-light">
          <p tw="font-medium">{totalUptime}%</p>
        </div>
        {/* Empty State */}
        <div tw="flex flex-row relative">
          {new Array(data.length).fill(null).map((_, i) => {
            return <div key={i} tw="h-16 w-3 rounded-full mr-1 bg-black/20" />;
          })}
          <div tw="flex flex-row-reverse absolute left-0">
            {days.map((item, i) => {
              const isBlackListed = Boolean(item.blacklist);
              if (isBlackListed) {
                return (
                  <div
                    key={i}
                    tw="h-16 w-3 rounded-full mr-1 bg-status-operational/90"
                  />
                );
              }
              return (
                <div
                  key={i}
                  tw={cn(
                    "mr-1 h-16 w-3 rounded-full",
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
