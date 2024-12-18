import type { Period, Quantile } from "@/lib/monitor/utils";
import type { ResponseGraph } from "@/lib/tb";
import type { Region } from "@openstatus/db/src/schema/constants";
import { SimpleChart } from "./simple-chart";
import { groupDataByTimestamp } from "./utils";

export function SimpleChartWrapper({
  data,
  period,
  quantile,
  region,
}: {
  data: ResponseGraph[];
  period: Period;
  quantile: Quantile;
  region: Region;
}) {
  const group = groupDataByTimestamp(data, period, quantile);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24">
        <p className="font-mono">{region}</p>
      </div>
      <SimpleChart
        data={group.data.map((d) => ({
          timestamp: d.timestamp,
          latency: d[region],
        }))}
      />
    </div>
  );
}
