"use client";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns as regionColumns } from "@/components/data-table/response-logs/regions/columns";
// import DatePicker from "@/components/date-picker";
import { GlobalUptimeSection } from "@/components/metric/global-uptime/section";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { RegionMetric } from "@/data/region-metrics";
import { mapRegionMetrics } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";
import React from "react";
import { DropdownPeriod } from "@/components/controls-search/dropdown-period";
import { CommandRegion } from "@/components/controls-search/command-region";
import { ButtonReset } from "@/components/controls-search/button-reset";
import { AuditLogsWrapper } from "@/components/data-table/audit-logs/wrapper";
import { DropdownPercentile } from "@/components/controls-search/dropdown-percentile";
import { ChartAreaTimingPhases } from "@/components/chart/chart-area-timing-phases";
import { DropdownInterval } from "@/components/controls-search/dropdown-interval";

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [{ period, regions: selectedRegions, percentile, interval }] =
    useQueryStates(searchParamsParsers);
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
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
    return mapRegionMetrics(regionTimeline, monitor?.regions ?? []);
  }, [regionTimeline, monitor]);

  if (!monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
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
        />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Uptime</SectionTitle>
          <SectionDescription>
            Uptime accross all the regions
          </SectionDescription>
        </SectionHeader>
        <ChartBarUptime
          monitorId={id}
          type={monitor.jobType as "http" | "tcp"}
          period={period}
          regions={monitor.regions.filter((region) =>
            selectedRegions.includes(region)
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
          />
        ) : (
          <ChartAreaLatency
            monitorId={id}
            percentile={percentile}
            degradedAfter={monitor.degradedAfter}
            type={monitor.jobType as "http" | "tcp"}
            period={period}
          />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Timeline</SectionTitle>
          <SectionDescription>
            What&apos;s happening on your monitor
          </SectionDescription>
        </SectionHeader>
        <AuditLogsWrapper monitorId={id} />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Regions</SectionTitle>
          <SectionDescription>
            Every region&apos;s latency over the last 24 hours
          </SectionDescription>
        </SectionHeader>
        <DataTable data={regionMetrics} columns={regionColumns} />
      </Section>
    </SectionGroup>
  );
}
