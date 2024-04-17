import { Shell } from "@/components/dashboard/shell";
import { getHomeStatsData } from "@/lib/tb";
import { numberFormatter } from "@/lib/utils";

export async function Stats() {
  const tbTotalStats = await getHomeStatsData({});
  const tbLastHourStats = await getHomeStatsData({ period: "1h" });
  // const totalActiveMonitors = await api.monitor.getTotalActiveMonitors.query();

  return (
    <Shell>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-16">
        <div className="text-center">
          <h3 className="font-cal text-3xl">
            {numberFormatter(tbTotalStats?.[0].count || 0)}
          </h3>
          <p className="text-muted-foreground font-light">Total pings</p>
        </div>
        <div className="text-center">
          <h3 className="font-cal text-3xl">
            {numberFormatter(tbLastHourStats?.[0].count || 62000000)}
          </h3>
          <p className="text-muted-foreground font-light">
            Pings in the last hour
          </p>
        </div>
        <div className="text-center">
          <h3 className="font-cal text-3xl">
            {/* {numberFormatter(totalActiveMonitors)} */}
            2400+
          </h3>
          <p className="text-muted-foreground font-light">Active monitors</p>
        </div>
      </div>
    </Shell>
  );
}
