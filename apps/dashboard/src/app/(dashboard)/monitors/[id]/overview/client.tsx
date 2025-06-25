"use client";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import { BlockWrapper } from "@/components/content/block-wrapper";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/audit-logs/columns";
import { columns as regionColumns } from "@/components/data-table/response-logs/regions/columns";
// import DatePicker from "@/components/date-picker";
import { GlobalUptimeSection } from "@/components/metric/global-uptime/section";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { auditLogs } from "@/data/audit-logs";
import type { RegionMetric } from "@/data/region-metrics";
import { mapRegionMetrics } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";
import React from "react";
import { DropdownPeriod } from "@/components/search-controls/dropdown-period";
import { CommandRegion } from "@/components/search-controls/command-region";
import { ButtonReset } from "@/components/search-controls/button-reset";

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [{ period, regions: selectedRegions }] =
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

  console.log(regionMetrics, regionTimeline, monitor?.regions);

  if (!monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <DropdownPeriod />
          {/* <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Last 7 days
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DatePicker />
            </PopoverContent>
            </Popover> */}
          <CommandRegion regions={monitor.regions} />
          <ButtonReset />
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
        />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Latency</SectionTitle>
          <SectionDescription>
            Average latency accross all the regions
          </SectionDescription>
        </SectionHeader>
        <ChartAreaLatency
          monitorId={id}
          type={monitor.jobType as "http" | "tcp"}
          period={period}
        />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Timeline</SectionTitle>
          <SectionDescription>
            What&apos;s happening on your monitor
          </SectionDescription>
        </SectionHeader>
        <BlockWrapper>
          <DataTable
            columns={columns}
            data={auditLogs}
            paginationComponent={DataTablePaginationSimple}
          />
        </BlockWrapper>
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
