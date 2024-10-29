import type { Period, Quantile } from "@/lib/monitor/utils";
import type { ResponseGraph } from "@/lib/tb";
import { Chart } from "./chart";
import { groupDataByTimestamp } from "./utils";

export function ChartWrapper({
  data,
  period,
  quantile,
}: {
  data: ResponseGraph[];
  period: Period;
  quantile: Quantile;
}) {
  const group = groupDataByTimestamp(data, period, quantile);
  return <Chart data={group.data} regions={group.regions} />;
}
