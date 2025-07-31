"use client";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartAreaTimingPhases } from "@/components/chart/chart-area-timing-phases";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import { ChartLineRegions } from "@/components/chart/chart-line-regions";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { ButtonReset } from "@/components/controls-search/button-reset";
import { CommandRegion } from "@/components/controls-search/command-region";
import { DropdownInterval } from "@/components/controls-search/dropdown-interval";
import { DropdownPercentile } from "@/components/controls-search/dropdown-percentile";
import { DropdownPeriod } from "@/components/controls-search/dropdown-period";
import { AuditLogsWrapper } from "@/components/data-table/audit-logs/wrapper";
import { columns as regionColumns } from "@/components/data-table/response-logs/regions/columns";
import { GlobalUptimeSection } from "@/components/metric/global-uptime/section";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mapRegionMetrics } from "@/data/metrics.client";
import type { RegionMetric } from "@/data/region-metrics";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import React from "react";
import { searchParamsParsers } from "./search-params";

const TIMELINE_INTERVAL = 30; // in days

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [{ period, regions: selectedRegions, percentile, interval }] =
    useQueryStates(searchParamsParsers);
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  const regionTimelineQuery = {
    ...trpc.tinybird.metricsRegions.queryOptions({
      monitorId: id,
      period: period,
      type: (monitor?.jobType ?? "http") as "http" | "tcp",
      regions: selectedRegions,
      // Request 30-minute buckets by default
      interval: 30,
    }),
    enabled: !!monitor,
  } as const;

  const { data: regionTimeline } = useQuery(regionTimelineQuery);

  const regionMetrics: RegionMetric[] = React.useMemo(() => {
    return mapRegionMetrics(regionTimeline, monitor?.regions ?? [], percentile);
  }, [regionTimeline, monitor, percentile]);

  if (!monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            {monitor.jobType === "http" ? (
              <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                {monitor.url}
              </a>
            ) : (
              monitor.url
            )}
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <div>
            <DropdownPeriod /> including{" "}
            <CommandRegion regions={monitor.regions} />
          </div>
          <div>
            <ButtonReset only={["period", "regions"]} />
          </div>
        </div>
        <GlobalUptimeSection
          monitorId={id}
          jobType={monitor.jobType as "http" | "tcp"}
          period={period}
          regions={selectedRegions}
        />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Uptime</SectionTitle>
          <SectionDescription>
            Uptime accross all the selected regions
          </SectionDescription>
        </SectionHeader>
        <ChartBarUptime
          monitorId={id}
          type={monitor.jobType as "http" | "tcp"}
          period={period}
          regions={monitor.regions.filter((region) =>
            selectedRegions.includes(region),
          )}
        />
      </Section>
      <Section>
        {/* TODO: based on http, we have Timing Phases instead of Latency */}
        <SectionHeader>
          <SectionTitle>Latency</SectionTitle>
          <SectionDescription>
            Response time accross all the regions
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <div>
            The <DropdownPercentile /> quantile within a <DropdownInterval />{" "}
            resolution
          </div>
          <div>
            <ButtonReset only={["percentile", "interval"]} />
          </div>
        </div>
        {monitor.jobType === "http" ? (
          <ChartAreaTimingPhases
            monitorId={id}
            degradedAfter={monitor.degradedAfter}
            type={monitor.jobType as "http"}
            period={period}
            percentile={percentile}
            interval={interval}
            regions={selectedRegions}
          />
        ) : (
          <ChartAreaLatency
            monitorId={id}
            percentile={percentile}
            degradedAfter={monitor.degradedAfter}
            type={monitor.jobType as "http" | "tcp"}
            period={period}
            regions={selectedRegions}
          />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Regions</SectionTitle>
          <SectionDescription>
            Every selected region&apos;s latency trend
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <div>
            The <DropdownPercentile /> quantile trend over the{" "}
            <DropdownPeriod />
          </div>
          <div>
            <ButtonReset only={["percentile", "period"]} />
          </div>
        </div>
        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="chart">Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="table">
            <DataTable data={regionMetrics} columns={regionColumns} />
          </TabsContent>
          <TabsContent value="chart">
            <ChartLineRegions
              className="mt-3"
              regions={monitor.regions.filter((region) =>
                selectedRegions.includes(region),
              )}
              data={regionMetrics.reduce(
                (acc, region) => {
                  region.trend.forEach((t) => {
                    const existing = acc.find(
                      (d) => d.timestamp === t.timestamp,
                    );
                    if (existing) {
                      existing[region.region] = t[region.region];
                    } else {
                      acc.push({
                        timestamp: t.timestamp,
                        [region.region]: t[region.region],
                      });
                    }
                  });
                  return acc;
                },
                [] as { timestamp: number; [key: string]: number }[],
              )}
            />
          </TabsContent>
        </Tabs>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Timeline</SectionTitle>
          <SectionDescription>
            What happened to your monitor over the last {TIMELINE_INTERVAL} days
          </SectionDescription>
        </SectionHeader>
        <AuditLogsWrapper monitorId={id} interval={TIMELINE_INTERVAL} />
      </Section>
    </SectionGroup>
  );
}
