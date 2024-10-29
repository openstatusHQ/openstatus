import type { Period, Quantile } from "@/lib/monitor/utils";
import { SimpleChart } from "./simple-chart";
import { groupDataByTimestamp } from "./utils";
import type { Region } from "@openstatus/db/src/schema/constants";
import type { ResponseGraph } from "@/lib/tb";

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
      <SimpleChart data={group.data} region={region} />
    </div>
  );
}
