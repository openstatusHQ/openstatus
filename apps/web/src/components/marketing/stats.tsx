import { Shell } from "@/components/dashboard/shell";
import { getHomeStatsData } from "@/lib/tb";
import { numberFormatter } from "@/lib/utils";
import { api } from "@/trpc/server";

export async function Stats() {
  const last10m = new Date().getTime() - 60 * 60 * 1000; // cron timestamp 10m ago
  const tbTotalStats = await getHomeStatsData({});
  const tbLast10mStats = await getHomeStatsData({
    cronTimestamp: last10m,
  });
  // FIXME:
  // const totalActiveMonitors = await api.monitor.getTotalActiveMonitors.query();

  return (
    <Shell>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-16">
        <div className="text-center">
          <h3 className="font-cal text-xl">
            {tbTotalStats && tbTotalStats?.length > 0
              ? numberFormatter(tbTotalStats[0].count)
              : 0}
          </h3>
          <p className="text-muted-foreground text-xs">Total pings</p>
        </div>
        <div className="text-center">
          <h3 className="font-cal text-xl">
            {tbLast10mStats && tbLast10mStats?.length > 0
              ? numberFormatter(tbLast10mStats[0].count)
              : 0}
          </h3>
          <p className="text-muted-foreground text-xs">
            Pings in the last 10 minutes
          </p>
        </div>
        <div className="text-center">
          {/* FIXME: */}
          {/* <h3 className="font-cal text-xl">
            {tbLast10mStats && tbLast10mStats?.length > 0
              ? numberFormatter(totalActiveMonitors)
              : 0}
          </h3>
          <p className="text-muted-foreground text-xs">Active monitors</p> */}
        </div>
      </div>
    </Shell>
  );
}
