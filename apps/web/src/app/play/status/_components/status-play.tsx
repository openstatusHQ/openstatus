import { Label } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { Tracker } from "@/components/tracker/tracker";
import { getHomeMonitorListData } from "@/lib/tb";
import { convertTimezoneToGMT, getRequestHeaderTimezone } from "@/lib/timezone";
import { HeaderPlay } from "../../_components/header-play";
import { TimezoneCombobox } from "./timezone-combobox";

export default async function StatusPlay({ timezone }: { timezone?: string }) {
  const requestTimezone = getRequestHeaderTimezone();
  const gmt = convertTimezoneToGMT(timezone);

  const data = await getHomeMonitorListData({ timezone: gmt });

  return (
    <Shell>
      <div className="relative grid gap-4">
        <HeaderPlay
          title="Status Page"
          description="Gain the trust of your users by showing them the uptime of your API or website."
        />
        <div className="mx-auto w-full max-w-md">
          {data && <Tracker data={data} name="Ping" description="Pong" />}
        </div>
        <div className="mt-6 flex justify-start">
          <div className="grid items-center gap-1">
            <Label className="text-muted-foreground text-xs">Timezone</Label>
            <TimezoneCombobox
              defaultValue={timezone || requestTimezone || undefined}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}
