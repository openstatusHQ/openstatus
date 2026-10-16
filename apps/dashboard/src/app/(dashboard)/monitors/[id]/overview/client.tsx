"use client";

import { useQuery } from "@tanstack/react-query";
import { endOfDay } from "date-fns";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import React, { useEffect } from "react";
import { toast } from "sonner";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartAreaTimingPhases } from "@/components/chart/chart-area-timing-phases";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { ButtonReset } from "@/components/controls-search/button-reset";
import { CommandRegion } from "@/components/controls-search/command-region";
import { DropdownInterval } from "@/components/controls-search/dropdown-interval";
import { DropdownPercentile } from "@/components/controls-search/dropdown-percentile";
import { DropdownPeriod } from "@/components/controls-search/dropdown-period";
import { AuditLogsWrapper } from "@/components/data-table/audit-logs/wrapper";
import {
  RegionsDataTable,
  RegionsLegend,
} from "@/components/data-table/response-logs/regions/data-table";
import { GlobalUptimeSection } from "@/components/metric/global-uptime/section";
import { PopoverQuantile } from "@/components/popovers/popover-quantile";
import { PopoverResolution } from "@/components/popovers/popover-resolution";
import {
  FREE_MAX_PERIOD,
  isPaidPeriod,
  mapRegionMetrics,
} from "@/data/metrics.client";
import { periodToFromDate, periodToInterval } from "@/data/metrics.client";
import type { RegionMetric } from "@/data/region-metrics";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

const TIMELINE_INTERVAL = 30; // in days

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [{ period, regions, percentile, interval }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  const isBlockedPeriod = workspace?.plan === "free" && isPaidPeriod(period);
  // snap free workspaces back synchronously so charts never fire (and the server
  // never rejects) a paid-only window; the effect below fixes the URL.
  const effectivePeriod = isBlockedPeriod ? FREE_MAX_PERIOD : period;

  useEffect(() => {
    if (!isBlockedPeriod) return;
    const timeout = setTimeout(() => {
      toast.error("30 and 90 day windows require a paid plan", {
        description: "Showing the last 14 days instead.",
      });
      setSearchParams({ period: FREE_MAX_PERIOD });
    }, 0);
    return () => clearTimeout(timeout);
  }, [isBlockedPeriod, setSearchParams]);

  const selectedRegions = regions ?? undefined;
  const fromDate = periodToFromDate[effectivePeriod];
  const toDate = endOfDay(new Date());

  const regionTimelineQuery = {
    ...trpc.tinybird.metricsRegions.queryOptions({
      monitorId: id,
      period: effectivePeriod,
      type: (monitor?.jobType ?? "http") as
        | "http"
        | "tcp"
        | "dns"
        | "icmp"
        | "grpc",
      regions: selectedRegions,
      // bucket by period (daily at 30d/90d) to keep payload + chart readable
      interval: periodToInterval[effectivePeriod],
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    }),
    enabled: !!monitor,
  } as const;

  const { data: regionTimeline } = useQuery(regionTimelineQuery);

  const regionMetrics: RegionMetric[] = React.useMemo(() => {
    return mapRegionMetrics(regionTimeline, [
      ...(monitor?.regions ?? []),
      ...(monitor?.privateLocations?.map((location) =>
        location.id.toString(),
      ) ?? []),
    ]);
  }, [regionTimeline, monitor]);

  if (!monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{monitor.name}</SectionTitle>
            <SectionDescription className="truncate">
              {monitor.jobType === "http" ? (
                <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                  {monitor.url}
                </a>
              ) : (
                monitor.url
              )}
            </SectionDescription>
          </SectionHeader>
          <div>
            <ButtonReset
              only={["period", "regions", "percentile", "interval"]}
            />
          </div>
        </SectionHeaderRow>
        <div>
          <DropdownPeriod /> including{" "}
          <CommandRegion
            regions={monitor.regions}
            privateLocations={monitor.privateLocations}
          />
        </div>
        <GlobalUptimeSection
          monitorId={id}
          jobType={monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc"}
          period={effectivePeriod}
          regions={selectedRegions}
        />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Uptime</SectionTitle>
          <SectionDescription>
            Uptime across all the selected regions
          </SectionDescription>
        </SectionHeader>
        <ChartBarUptime
          monitorId={id}
          type={monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc"}
          period={effectivePeriod}
          regions={selectedRegions}
        />
      </Section>
      <Section>
        {/* TODO: based on http, we have Timing Phases instead of Latency */}
        <SectionHeader>
          <SectionTitle>Latency</SectionTitle>
          <SectionDescription>
            Response time across the selected regions
          </SectionDescription>
        </SectionHeader>
        <div>
          The <DropdownPercentile /> <PopoverQuantile>quantile</PopoverQuantile>{" "}
          within a <DropdownInterval />{" "}
          <PopoverResolution>resolution</PopoverResolution>
        </div>
        {monitor.jobType === "http" ? (
          <ChartAreaTimingPhases
            monitorId={id}
            degradedAfter={monitor.degradedAfter}
            type={monitor.jobType as "http"}
            period={effectivePeriod}
            percentile={percentile}
            interval={interval}
            regions={selectedRegions}
          />
        ) : (
          <ChartAreaLatency
            monitorId={id}
            percentile={percentile}
            degradedAfter={monitor.degradedAfter}
            type={monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc"}
            period={effectivePeriod}
            regions={selectedRegions}
          />
        )}
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Regions</SectionTitle>
          <SectionDescription>
            Response time spread per selected region
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            Latency spread over the <DropdownPeriod />
          </div>
          <RegionsLegend degradedAfter={monitor.degradedAfter} />
        </div>
        <RegionsDataTable
          data={regionMetrics}
          privateLocations={monitor.privateLocations ?? []}
          loading={!regionTimeline}
          degradedAfter={monitor.degradedAfter}
        />
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
