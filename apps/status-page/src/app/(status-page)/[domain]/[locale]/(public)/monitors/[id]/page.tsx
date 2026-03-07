"use client";

import { ButtonBack } from "@/components/button/button-back";
import { ButtonCopyLink } from "@/components/button/button-copy-link";
import {
  ChartAreaPercentiles,
  ChartAreaPercentilesSkeleton,
} from "@/components/chart/chart-area-percentiles";
import {
  ChartBarUptime,
  ChartBarUptimeSkeleton,
} from "@/components/chart/chart-bar-uptime";
import {
  ChartLineRegions,
  ChartLineRegionsSkeleton,
} from "@/components/chart/chart-line-regions";
import { PopoverQuantile } from "@/components/popover/popover-quantile";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusBlankMonitors } from "@/components/status-page/status-blank";
import {
  StatusChartContent,
  StatusChartDescription,
  StatusChartHeader,
  StatusChartTitle,
} from "@/components/status-page/status-charts";
import {
  StatusMonitorTabs,
  StatusMonitorTabsContent,
  StatusMonitorTabsList,
  StatusMonitorTabsTrigger,
  StatusMonitorTabsTriggerLabel,
  StatusMonitorTabsTriggerValue,
  StatusMonitorTabsTriggerValueSkeleton,
} from "@/components/status-page/status-monitor-tabs";
import {
  formatMillisecondsRange,
  formatNumber,
  formatPercentage,
} from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";
import { searchParamsParsers } from "./search-params";

export default function Page() {
  const [{ tab }, setSearchParams] = useQueryStates(searchParamsParsers);
  const trpc = useTRPC();
  const { id, domain } = useParams<{ id: string; domain: string }>();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  const tempMonitor = useMemo(() => {
    return page?.monitors.find((monitor) => monitor.id === Number(id));
  }, [page, id]);

  if (!page) return null;

  const { data: monitor, isLoading } = useQuery(
    trpc.statusPage.getMonitor.queryOptions({ id: Number(id), slug: domain }),
  );

  const globalLatencyData = useMemo(() => {
    if (!monitor?.data.latency?.data) return [];

    return monitor.data.latency.data
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp).toLocaleString("default", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "numeric",
          timeZoneName: "short",
        }),
      }));
  }, [monitor?.data.latency?.data]);

  const regionLatencyData = useMemo(() => {
    if (!monitor?.data.regions?.data) return [];

    const grouped = monitor.data.regions.data
      .sort((a, b) => a.timestamp - b.timestamp)
      .reduce(
        (acc, item) => {
          const timestamp = new Date(item.timestamp).toLocaleString("default", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "numeric",
            timeZoneName: "short",
          });

          if (!acc[timestamp]) {
            acc[timestamp] = { timestamp };
          }
          acc[timestamp][item.region] = item.p75Latency;
          return acc;
        },
        {} as Record<
          string,
          { timestamp: string; [region: string]: number | string | null }
        >,
      );

    return Object.values(grouped);
  }, [monitor?.data.regions?.data]);

  const uptimeData = useMemo(() => {
    if (!monitor?.data.uptime?.data) return [];
    return monitor.data.uptime.data
      .sort((a, b) => a.interval.getTime() - b.interval.getTime())
      .map((item) => ({
        timestamp: item.interval.toLocaleString("default", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "numeric",
          timeZoneName: "short",
        }),
        ...item,
      }));
  }, [monitor?.data.uptime?.data]);

  const { totalChecks, uptimePercentage, slowestRegion, p75Range } =
    useMemo(() => {
      const p75Range = globalLatencyData.reduce(
        (acc, item) => ({
          min: Math.min(acc.min, item.p75Latency),
          max: Math.max(acc.max, item.p75Latency),
        }),
        {
          min: Number.POSITIVE_INFINITY,
          max: Number.NEGATIVE_INFINITY,
        },
      );

      const uptimeStats = uptimeData.reduce(
        (acc, item) => {
          return {
            total: acc.total + item.success + item.degraded + item.error,
            success: acc.success + item.success,
            degraded: acc.degraded + item.degraded,
            error: acc.error + item.error,
          };
        },
        { total: 0, success: 0, degraded: 0, error: 0 },
      );

      const uptimePercentage =
        uptimeStats.total > 0
          ? (uptimeStats.success + uptimeStats.degraded) / uptimeStats.total
          : 0;

      const regionAverages = regionLatencyData.reduce(
        (acc, item) => {
          Object.keys(item).forEach((key) => {
            if (key !== "timestamp" && typeof item[key] === "number") {
              if (!acc[key]) {
                acc[key] = { sum: 0, count: 0 };
              }
              acc[key].sum += item[key] as number;
              acc[key].count += 1;
            }
          });
          return acc;
        },
        {} as Record<string, { sum: number; count: number }>,
      );

      const slowestRegion = Object.entries(regionAverages)
        .map(([region, stats]) => ({
          region,
          avgLatency: stats.count > 0 ? stats.sum / stats.count : 0,
        }))
        .sort((a, b) => b.avgLatency - a.avgLatency)[0];

      return {
        totalChecks: formatNumber(uptimeStats.total, {
          notation: "compact",
          compactDisplay: "short",
        }).replace("K", "k"),
        uptimePercentage:
          uptimeStats.total > 0 ? formatPercentage(uptimePercentage) : "N/A",
        slowestRegion: slowestRegion?.region || "N/A",
        p75Range:
          p75Range.min !== Number.POSITIVE_INFINITY ||
          p75Range.max !== Number.NEGATIVE_INFINITY
            ? formatMillisecondsRange(p75Range.min, p75Range.max)
            : "N/A",
      };
    }, [uptimeData, regionLatencyData, globalLatencyData]);

  if (!isLoading && !monitor) {
    return (
      <StatusBlankMonitors
        title="Monitor not found"
        description="The monitor you are looking for does not exist."
      />
    );
  }

  return (
    <Status>
      <StatusHeader>
        <StatusTitle>{tempMonitor?.name}</StatusTitle>
        <StatusDescription>{tempMonitor?.description}</StatusDescription>
      </StatusHeader>
      <StatusContent className="flex flex-col gap-6">
        <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
          <ButtonBack href="./" />
          <ButtonCopyLink />
        </div>
        <StatusMonitorTabs
          defaultValue={tab}
          onValueChange={(value) =>
            setSearchParams({ tab: value as "global" | "region" | "uptime" })
          }
        >
          <StatusMonitorTabsList className="grid grid-cols-3">
            <StatusMonitorTabsTrigger value="global">
              <StatusMonitorTabsTriggerLabel>
                Global Latency
              </StatusMonitorTabsTriggerLabel>
              {isLoading ? (
                <StatusMonitorTabsTriggerValueSkeleton />
              ) : (
                <StatusMonitorTabsTriggerValue>
                  {p75Range}{" "}
                  <Badge variant="outline" className="py-px text-[10px]">
                    p75
                  </Badge>
                </StatusMonitorTabsTriggerValue>
              )}
            </StatusMonitorTabsTrigger>
            <StatusMonitorTabsTrigger value="region">
              <StatusMonitorTabsTriggerLabel>
                Region Latency
              </StatusMonitorTabsTriggerLabel>
              {isLoading ? (
                <StatusMonitorTabsTriggerValueSkeleton />
              ) : (
                <StatusMonitorTabsTriggerValue>
                  {tempMonitor?.regions.length} regions{" "}
                  <Badge
                    variant="outline"
                    className="py-px font-mono text-[10px]"
                  >
                    {slowestRegion} <TrendingUp className="size-3" />
                  </Badge>
                </StatusMonitorTabsTriggerValue>
              )}
            </StatusMonitorTabsTrigger>
            <StatusMonitorTabsTrigger value="uptime">
              <StatusMonitorTabsTriggerLabel>
                Uptime
              </StatusMonitorTabsTriggerLabel>
              {isLoading ? (
                <StatusMonitorTabsTriggerValueSkeleton />
              ) : (
                <StatusMonitorTabsTriggerValue>
                  {uptimePercentage}{" "}
                  <Badge variant="outline" className="py-px text-[10px]">
                    {totalChecks} checks
                  </Badge>
                </StatusMonitorTabsTriggerValue>
              )}
            </StatusMonitorTabsTrigger>
          </StatusMonitorTabsList>
          <StatusMonitorTabsContent value="global">
            <StatusChartContent>
              <StatusChartHeader>
                <StatusChartTitle>Global Latency</StatusChartTitle>
                <StatusChartDescription>
                  The aggregated latency from all active regions based on
                  different <PopoverQuantile>quantiles</PopoverQuantile>.
                </StatusChartDescription>
              </StatusChartHeader>
              {isLoading ? (
                <ChartAreaPercentilesSkeleton className="h-[250px]" />
              ) : (
                <ChartAreaPercentiles
                  className="h-[250px]"
                  legendClassName="justify-start pt-1 ps-1"
                  legendVerticalAlign="top"
                  xAxisHide={false}
                  data={globalLatencyData}
                  yAxisDomain={[0, "dataMax"]}
                />
              )}
            </StatusChartContent>
          </StatusMonitorTabsContent>
          <StatusMonitorTabsContent value="region">
            <StatusChartContent>
              <StatusChartHeader>
                <StatusChartTitle>Latency by Region</StatusChartTitle>
                <StatusChartDescription>
                  {/* TODO: we could add an information to p95 that it takes the highest selected global latency percentile */}
                  Region latency per{" "}
                  <code className="font-medium text-foreground">p75</code>{" "}
                  <PopoverQuantile>quantile</PopoverQuantile>, sorted by slowest
                  region. Compare up to{" "}
                  <code className="font-medium text-foreground">6</code>{" "}
                  regions.
                </StatusChartDescription>
              </StatusChartHeader>
              {isLoading ? (
                <ChartLineRegionsSkeleton className="h-[250px]" />
              ) : (
                <ChartLineRegions
                  className="h-[250px]"
                  data={regionLatencyData}
                  defaultRegions={tempMonitor?.regions}
                />
              )}
            </StatusChartContent>
          </StatusMonitorTabsContent>
          <StatusMonitorTabsContent value="uptime">
            <StatusChartContent>
              <StatusChartHeader>
                <StatusChartTitle>Total Uptime</StatusChartTitle>
                <StatusChartDescription>
                  Main values of uptime and availability, transparent.
                </StatusChartDescription>
              </StatusChartHeader>
              {isLoading ? (
                <ChartBarUptimeSkeleton className="h-[250px]" />
              ) : (
                <ChartBarUptime className="h-[250px]" data={uptimeData} />
              )}
            </StatusChartContent>
          </StatusMonitorTabsContent>
        </StatusMonitorTabs>
      </StatusContent>
    </Status>
  );
}
