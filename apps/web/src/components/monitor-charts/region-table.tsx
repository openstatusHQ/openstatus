import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";
import { flyRegionsDict } from "@openstatus/utils";

import { formatNumber } from "@/components/monitor-dashboard/metrics-card";
import type { ResponseTimeMetricsByRegion } from "@/lib/tb";
import type { Region } from "@openstatus/db/src/schema/constants";
import { SimpleChart } from "./simple-chart";

export interface RegionTableProps {
  regions: Region[];
  data: {
    regions: Region[];
    data: (Partial<Record<Region, number>> & { timestamp: string })[];
  };
  metricsByRegion: ResponseTimeMetricsByRegion[];
  caption?: string;
}

/**
 * @deprecated use the /region/data-table.tsx component instead, this is only used for the content blog posts
 */
export function RegionTable({
  regions,
  data,
  metricsByRegion,
  caption = "A list of all the selected regions.",
}: RegionTableProps) {
  return (
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Region</TableHead>
          <TableHead className="min-w-[300px]">Trend</TableHead>
          <TableHead className="w-[50px]">P50</TableHead>
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
                  <SimpleChart
                    data={data.data.map((d) => ({
                      timestamp: d.timestamp,
                      latency: d[region],
                    }))}
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(metrics?.p50Latency)}
                  <span className="font-normal text-muted-foreground text-xs">
                    ms
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(metrics?.p95Latency)}
                  <span className="font-normal text-muted-foreground text-xs">
                    ms
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(metrics?.p99Latency)}
                  <span className="font-normal text-muted-foreground text-xs">
                    ms
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
