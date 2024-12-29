import { Shell } from "@/components/dashboard/shell";
import { env } from "@/env";
import { numberFormatter } from "@/lib/utils";
import { OSTinybird } from "@openstatus/tinybird";

const _tb = new OSTinybird(env.TINY_BIRD_API_KEY);

export async function Stats() {
  // const tbLastHourStats = await tb.homeStats({ period: "1h" });
  // const tbWeeklyStats = await tb.homeStats({ period: "1w" });
  // const totalActiveMonitors = await api.monitor.getTotalActiveMonitors.query();

  return (
    <Shell>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-16">
        <div className="text-center">
          <h3 className="font-cal text-3xl">
            {/* {numberFormatter(tbWeeklyStats?.data?.[0]?.count || 0)} */}
            {numberFormatter(26_000_000)}
          </h3>
          <p className="font-light text-muted-foreground">Weekly pings</p>
        </div>
        <div className="text-center">
          <h3 className="font-cal text-3xl">
            {/* {numberFormatter(tbLastHourStats?.data?.[0]?.count || 0)} */}
            {numberFormatter(155_000)}
          </h3>
          <p className="font-light text-muted-foreground">
            Pings in the last hour
          </p>
        </div>
        <div className="text-center">
          <h3 className="font-cal text-3xl">
            {/* {numberFormatter(totalActiveMonitors)} */}
            3400+
          </h3>
          <p className="font-light text-muted-foreground">Active monitors</p>
        </div>
      </div>
    </Shell>
  );
}
