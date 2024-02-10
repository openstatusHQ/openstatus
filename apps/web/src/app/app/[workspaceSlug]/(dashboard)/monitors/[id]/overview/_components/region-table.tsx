import type { Region, ResponseTimeMetricsByRegion } from "@openstatus/tinybird";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";

import { formatNumber } from "../../_components/metrics-card";
import { SimpleChart } from "./simple-chart";

interface Props {
  regions: Region[];
  data: {
    regions: Region[];
    data: (Partial<Record<Region, string>> & { timestamp: string })[];
  };
  metricsByRegion: ResponseTimeMetricsByRegion[];
}

export function RegionTable({ regions, data, metricsByRegion }: Props) {
  return (
    <Table>
      <TableCaption>A list of your regions.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Region</TableHead>
          <TableHead className="min-w-[300px]">Trend</TableHead>
          <TableHead className="w-[50px]">AVG</TableHead>
          <TableHead className="w-[50px]">P95</TableHead>
          <TableHead className="w-[50px]">P99</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {regions
          .filter((region) => regions.includes(region))
          .map((region) => {
            const { code, flag, location } = flyRegionsDict[region];
            const metrics = metricsByRegion.find((m) => m.region === region);
            return (
              <TableRow key={region}>
                <TableCell>
                  <p className="text-muted-foreground text-xs">{location}</p>
                  <p className="font-mono text-xs">
                    {flag} {code}
                  </p>
                </TableCell>
                <TableCell>
                  <SimpleChart data={data.data} region={region} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(metrics?.avgLatency)}
                  <span className="text-muted-foreground text-xs font-normal">
                    ms
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(metrics?.p95Latency)}
                  <span className="text-muted-foreground text-xs font-normal">
                    ms
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(metrics?.p99Latency)}
                  <span className="text-muted-foreground text-xs font-normal">
                    ms
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
      {/* <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>Total</TableCell>
          <TableCell className="text-right">0</TableCell>
        </TableRow>
      </TableFooter> */}
    </Table>
  );
}
