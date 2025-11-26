import fs from "node:fs";
import type { RegionMetricsChartTable } from "@/data/content";
import { type Region, regionDict } from "@openstatus/regions";
import { SimpleChart } from "./simple-chart";

export interface LatencyChartTableProps {
  staticFile: string;
  caption?: string;
}

interface LatencyChartTableData {
  regions: Region[];
  data: {
    regions: Region[];
    data: (Partial<Record<Region, number>> & { timestamp: string })[];
  };
  metricsByRegion: RegionMetricsChartTable[];
}

export function LatencyChartTable({
  staticFile,
  caption = "A list of all the selected regions.",
}: LatencyChartTableProps) {
  const data = JSON.parse(
    fs.readFileSync(`${process.cwd()}/public${staticFile}`, "utf8")
  ) as LatencyChartTableData;
  const { regions, data: chartData, metricsByRegion } = data;

  return (
    <div className="table-wrapper">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th className="w-[100px]">Region</th>
            <th>Trend</th>
            <th className="w-[50px]">P75</th>
            <th className="w-[50px]">P95</th>
            <th className="w-[50px]">P99</th>
          </tr>
        </thead>
        <tbody>
          {regions
            .filter((region) => regions.includes(region))
            .map((region) => {
              const regionConfig = regionDict[region as Region];
              const flag = regionConfig.flag;
              const code = regionConfig.code;
              const metrics = metricsByRegion.find((m) => m.region === region);
              return (
                <tr key={region}>
                  <td>
                    {flag} {code}
                  </td>
                  <td>
                    <SimpleChart
                      data={chartData.data.map((d) => ({
                        timestamp: d.timestamp,
                        latency: d[region],
                      }))}
                    />
                  </td>
                  <td>
                    {metrics?.p75Latency}
                    ms
                  </td>
                  <td>
                    {metrics?.p95Latency}
                    ms
                  </td>
                  <td>
                    {metrics?.p99Latency}
                    ms
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
