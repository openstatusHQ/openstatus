import type { ChartConfig } from "@openstatus/ui/components/ui/chart";

/**
 * `itemSorter` for `ChartLegend` and `ChartTooltip`: recharts 3 sorts items
 * alphabetically by default, this keeps the chart config (series) order.
 */
export function bySeriesOrder(config: ChartConfig) {
  const keys = Object.keys(config);
  return (item: { dataKey?: unknown }) => keys.indexOf(String(item.dataKey));
}
