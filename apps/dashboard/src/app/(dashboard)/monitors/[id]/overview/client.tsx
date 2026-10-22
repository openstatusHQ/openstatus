"use client";

import { Pause, Play, Trend } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay } from "date-fns";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import React, { useEffect } from "react";
import { toast } from "sonner";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartAreaTimingPhases } from "@/components/chart/chart-area-timing-phases";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import { ChartEmpty } from "@/components/chart/chart-empty";
import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
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
  PERIODS,
  hasMetricsData,
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
  const queryClient = useQueryClient();
  const resumeMonitor = useMutation(
    trpc.monitor.updateMonitors.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.monitor.pathKey() });
      },
      onError: () => toast.error("Failed to resume the monitor"),
    }),
  );

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

  const { data: regionTimeline, isError: isRegionTimelineError } =
    useQuery(regionTimelineQuery);

  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    ...trpc.tinybird.metrics.queryOptions({
      monitorId: id,
      period: effectivePeriod,
      type: (monitor?.jobType ?? "http") as
        | "http"
        | "tcp"
        | "dns"
        | "icmp"
        | "grpc",
      regions: selectedRegions,
    }),
    enabled: !!monitor,
  });
  const noData = !!metrics && !hasMetricsData(metrics);
  // a paused monitor keeps its history; the paused card only fills an empty slot
  const paused = monitor?.active === false && noData;
  // free plans ignore the region filter server-side, so they keep every row
  const filtersRegions =
    workspace?.plan !== "free" && !!selectedRegions?.length;
  const filteredOut = noData && filtersRegions;
  const maxPeriod = workspace?.plan === "free" ? FREE_MAX_PERIOD : "90d";
  const widerPeriod = PERIODS[PERIODS.indexOf(effectivePeriod) + 1];
  const canWiden =
    !!widerPeriod && PERIODS.indexOf(widerPeriod) <= PERIODS.indexOf(maxPeriod);

  const configuredRegions = React.useMemo(
    () => [
      ...(monitor?.regions ?? []),
      ...(monitor?.privateLocations?.map((location) =>
        location.id.toString(),
      ) ?? []),
    ],
    [monitor],
  );
  const regionMetrics: RegionMetric[] = React.useMemo(
    () =>
      mapRegionMetrics(
        regionTimeline,
        filtersRegions
          ? configuredRegions.filter((region) =>
              selectedRegions?.includes(region),
            )
          : configuredRegions,
      ),
    [regionTimeline, configuredRegions, filtersRegions, selectedRegions],
  );
  // e.g. a stale region in the URL after the monitor's regions were edited
  const regionsFilteredOut =
    filtersRegions &&
    configuredRegions.length > 0 &&
    regionMetrics.length === 0;

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
        <GlobalUptimeSection metrics={metrics} isLoading={isMetricsLoading} />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Uptime</SectionTitle>
          <SectionDescription>
            Uptime across all the selected regions
          </SectionDescription>
        </SectionHeader>
        {/* the slot keeps the chart's height so the tinybird fetch never shifts the page */}
        {paused ? (
          <ChartEmpty className="h-[130px]">
            <EmptyStateMedia>
              <Pause />
            </EmptyStateMedia>
            <EmptyStateTitle>This monitor is paused</EmptyStateTitle>
            <EmptyStateActions>
              <Button
                size="sm"
                disabled={resumeMonitor.isPending}
                onClick={() =>
                  resumeMonitor.mutate({ ids: [monitor.id], active: true })
                }
              >
                <Play />
                Resume monitor
              </Button>
              <Button size="sm" variant="outline" asChild>
                <NextLink href={`/monitors/${id}/edit`}>Edit monitor</NextLink>
              </Button>
            </EmptyStateActions>
          </ChartEmpty>
        ) : noData ? (
          <ChartEmpty className="h-[130px]">
            <EmptyStateMedia>
              <Trend />
            </EmptyStateMedia>
            <EmptyStateTitle>
              {filteredOut
                ? "No checks from the selected regions"
                : "No checks in this period"}
            </EmptyStateTitle>
            {filteredOut ? (
              <EmptyStateActions>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchParams({ regions: null })}
                >
                  Show all regions
                </Button>
              </EmptyStateActions>
            ) : canWiden ? (
              <EmptyStateActions>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchParams({ period: widerPeriod })}
                >
                  Widen time range
                </Button>
              </EmptyStateActions>
            ) : null}
          </ChartEmpty>
        ) : (
          <ChartBarUptime
            monitorId={id}
            type={monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc"}
            period={effectivePeriod}
            regions={selectedRegions}
          />
        )}
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
        {noData ? (
          <ChartEmpty>
            <EmptyStateMedia>{paused ? <Pause /> : <Trend />}</EmptyStateMedia>
            <EmptyStateTitle>
              {paused
                ? "No latency while paused"
                : filteredOut
                  ? "No latency from the selected regions"
                  : "No latency in this period"}
            </EmptyStateTitle>
            <EmptyStateDescription>
              {paused
                ? "Resume the monitor and response times fill in from the first check."
                : filteredOut
                  ? "Pick a region that has reported in this period."
                  : "The first check lands within a minute of activation."}
            </EmptyStateDescription>
          </ChartEmpty>
        ) : monitor.jobType === "http" ? (
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
        {isRegionTimelineError ? (
          <EmptyStateContainer>
            <EmptyStateTitle>Couldn&apos;t load region metrics</EmptyStateTitle>
            <EmptyStateDescription>
              Try again in a moment or pick another period.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <RegionsDataTable
            data={regionMetrics}
            privateLocations={monitor.privateLocations ?? []}
            loading={!regionTimeline}
            degradedAfter={monitor.degradedAfter}
            filteredOut={regionsFilteredOut}
            onShowAll={() => setSearchParams({ regions: null })}
          />
        )}
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
