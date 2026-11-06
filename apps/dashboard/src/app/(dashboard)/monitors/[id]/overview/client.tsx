"use client";

import { Check, Copy, Pause, Schedule, Trend } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { heartbeatExpectation } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { endOfDay } from "date-fns";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import React, { useEffect } from "react";
import { toast } from "sonner";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartAreaTimingPhases } from "@/components/chart/chart-area-timing-phases";
import { ChartBarPings } from "@/components/chart/chart-bar-pings";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import { ChartEmpty } from "@/components/chart/chart-empty";
import { Link } from "@/components/common/link";
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
import { HeartbeatSection } from "@/components/metric/heartbeat/section";
import { PopoverQuantile } from "@/components/popovers/popover-quantile";
import { PopoverResolution } from "@/components/popovers/popover-resolution";
import {
  HEARTBEAT_WINDOW_DAYS,
  downtimeSince,
  heartbeatWindowStart,
  pingDays,
} from "@/data/heartbeat.client";
import {
  FREE_MAX_PERIOD,
  hasMetricsData,
  isPaidPeriod,
  mapRegionMetrics,
} from "@/data/metrics.client";
import { periodToFromDate, periodToInterval } from "@/data/metrics.client";
import type { RegionMetric } from "@/data/region-metrics";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

const TIMELINE_INTERVAL = 30; // in days
const HEARTBEAT_POLL_MS = 30_000;
// someone is watching their job's first run land
const HEARTBEAT_WAITING_POLL_MS = 5_000;

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const { copy, isCopied } = useCopyToClipboard();
  const [{ period, regions, percentile, interval }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const { data: monitor } = useQuery({
    ...trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
    // a heartbeat's status is flipped by the sweep while the page is open
    refetchInterval: (query) =>
      query.state.data?.jobType === "heartbeat" ? HEARTBEAT_POLL_MS : false,
  });
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const isHeartbeat = monitor?.jobType === "heartbeat";

  const isBlockedPeriod =
    !isHeartbeat && workspace?.plan === "free" && isPaidPeriod(period);
  // snap free workspaces back synchronously so charts never fire (and the server
  // never rejects) a paid-only window; the effect below fixes the URL.
  const effectivePeriod = isBlockedPeriod ? FREE_MAX_PERIOD : period;

  useEffect(() => {
    if (!isBlockedPeriod) return;
    const timeout = setTimeout(() => {
      toast.error("Windows beyond 7 days require a paid plan", {
        description: "Showing the last 7 days instead.",
      });
      setSearchParams({ period: FREE_MAX_PERIOD });
    }, 0);
    return () => clearTimeout(timeout);
  }, [isBlockedPeriod, setSearchParams]);

  const selectedRegions = regions ?? undefined;
  const fromDate = periodToFromDate(effectivePeriod);
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
    enabled: !!monitor && !isHeartbeat,
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
    enabled: !!monitor && !isHeartbeat,
  });
  const noData = !!metrics && !hasMetricsData(metrics);
  // a paused monitor keeps its history; the paused card only fills an empty slot
  const paused = monitor?.active === false && noData;
  // free plans ignore the region filter server-side, so they keep every row
  const filtersRegions =
    workspace?.plan !== "free" && !!selectedRegions?.length;
  const filteredOut = noData && filtersRegions;

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

  const { data: heartbeat, isError: isHeartbeatError } = useQuery({
    ...trpc.monitor.heartbeat.queryOptions({ id: Number.parseInt(id) }),
    enabled: isHeartbeat,
    refetchInterval: (query) =>
      monitor?.active && query.state.data?.lastPingAt === null
        ? HEARTBEAT_WAITING_POLL_MS
        : HEARTBEAT_POLL_MS,
  });
  const waiting = heartbeat?.lastPingAt === null;
  const {
    data: pings,
    isError: isPingsError,
    dataUpdatedAt: pingsUpdatedAt,
  } = useQuery({
    ...trpc.monitor.heartbeatStatus.queryOptions({ id: Number.parseInt(id) }),
    // a heartbeat still waiting has no pings to fetch
    enabled: !!heartbeat && !waiting,
    // the state row is ahead of Tinybird right after a ping: catch up quickly
    refetchInterval: (query) =>
      query.state.data?.length === 0 &&
      heartbeat?.lastPingAt &&
      Date.now() - heartbeat.lastPingAt.getTime() < 10 * HEARTBEAT_POLL_MS
        ? HEARTBEAT_WAITING_POLL_MS
        : 2 * HEARTBEAT_POLL_MS,
  });
  const { data: monitorIncidents, isError: isIncidentsError } = useQuery({
    ...trpc.monitorIncident.list.queryOptions({
      monitorId: Number.parseInt(id),
    }),
    enabled: isHeartbeat,
    refetchInterval: 2 * HEARTBEAT_POLL_MS,
  });
  // keyed on the fetch's UTC day: the window rolls over at midnight, and an
  // unchanged refetch keeps the same array so the chart does not re-animate
  const pingsDay = new Date(pingsUpdatedAt).toISOString().slice(0, 10);
  const pingWindow = React.useMemo(() => {
    if (!pings) return null;
    const day = new Date(pingsDay);
    return { days: pingDays(pings, day), from: heartbeatWindowStart(day) };
  }, [pings, pingsDay]);
  const noPings =
    !!pingWindow && pingWindow.days.every((day) => day.ok + day.error === 0);

  if (!monitor) return null;

  return (
    <SectionGroup>
      <Section id="overview">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{monitor.name}</SectionTitle>
            <SectionDescription className="truncate">
              {monitor.jobType === "http" ? (
                <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                  {monitor.url}
                </a>
              ) : isHeartbeat ? (
                `Heartbeat · ${heartbeatExpectation(monitor)}`
              ) : (
                monitor.url
              )}
            </SectionDescription>
          </SectionHeader>
          {isHeartbeat ? null : (
            <div>
              <ButtonReset
                only={["period", "regions", "percentile", "interval"]}
              />
            </div>
          )}
        </SectionHeaderRow>
        {isHeartbeat ? (
          <>
            <div>Last {HEARTBEAT_WINDOW_DAYS} days</div>
            <HeartbeatSection
              monitor={monitor}
              heartbeat={heartbeat}
              isLoading={!isHeartbeatError}
              days={pingWindow?.days}
              downtime={
                pingWindow && monitorIncidents
                  ? downtimeSince(monitorIncidents, pingWindow.from)
                  : undefined
              }
              isWindowLoading={
                !waiting &&
                !isPingsError &&
                !isHeartbeatError &&
                !isIncidentsError
              }
            />
          </>
        ) : (
          <>
            <div>
              <DropdownPeriod /> including{" "}
              <CommandRegion
                regions={monitor.regions}
                privateLocations={monitor.privateLocations}
              />
            </div>
            <GlobalUptimeSection
              metrics={metrics}
              isLoading={isMetricsLoading}
            />
          </>
        )}
      </Section>
      {isHeartbeat ? (
        waiting ? (
          <Section id="waiting-for-ping">
            <EmptyStateContainer>
              <EmptyStateMedia>
                <Schedule />
              </EmptyStateMedia>
              <EmptyStateTitle>Waiting for first ping</EmptyStateTitle>
              <EmptyStateDescription>
                Call the heartbeat URL at the end of your job. Alerts start
                after the first ping, and this page updates when it arrives.
              </EmptyStateDescription>
              {heartbeat.pingUrl ? (
                <EmptyStateActions>
                  <Button
                    size="sm"
                    onClick={() =>
                      copy(heartbeat.pingUrl ?? "", {
                        successMessage: "Copied heartbeat URL to clipboard",
                      })
                    }
                  >
                    {isCopied ? <Check /> : <Copy />}
                    Copy Heartbeat URL
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/monitors/${id}/edit#heartbeat`}>
                      View examples
                    </Link>
                  </Button>
                </EmptyStateActions>
              ) : null}
            </EmptyStateContainer>
          </Section>
        ) : (
          <Section id="pings">
            <SectionHeader>
              <SectionTitle>Pings</SectionTitle>
              <SectionDescription>
                Pings received per UTC day over the last {HEARTBEAT_WINDOW_DAYS}{" "}
                days
              </SectionDescription>
            </SectionHeader>
            {/* the slot keeps the chart's height so the tinybird fetch never shifts the page */}
            {(isPingsError || isHeartbeatError) && !pingWindow ? (
              <ChartEmpty className="h-[130px]">
                <EmptyStateMedia>
                  <Trend />
                </EmptyStateMedia>
                <EmptyStateTitle>Couldn&apos;t load pings</EmptyStateTitle>
              </ChartEmpty>
            ) : noPings ? (
              <ChartEmpty className="h-[130px]">
                <EmptyStateMedia>
                  <Trend />
                </EmptyStateMedia>
                <EmptyStateTitle>
                  No pings in the last {HEARTBEAT_WINDOW_DAYS} days
                </EmptyStateTitle>
              </ChartEmpty>
            ) : (
              <ChartBarPings data={pingWindow?.days ?? []} />
            )}
          </Section>
        )
      ) : (
        <>
          <Section id="uptime">
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
                ) : null}
              </ChartEmpty>
            ) : (
              <ChartBarUptime
                monitorId={id}
                type={
                  monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc"
                }
                period={effectivePeriod}
                regions={selectedRegions}
              />
            )}
          </Section>
          <Section id="latency">
            {/* TODO: based on http, we have Timing Phases instead of Latency */}
            <SectionHeader>
              <SectionTitle>Latency</SectionTitle>
              <SectionDescription>
                Response time across the selected regions
              </SectionDescription>
            </SectionHeader>
            <div>
              The <DropdownPercentile />{" "}
              <PopoverQuantile>quantile</PopoverQuantile> within a{" "}
              <DropdownInterval />{" "}
              <PopoverResolution>resolution</PopoverResolution>
            </div>
            {noData ? (
              <ChartEmpty>
                <EmptyStateMedia>
                  {paused ? <Pause /> : <Trend />}
                </EmptyStateMedia>
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
                type={
                  monitor.jobType as "http" | "tcp" | "dns" | "icmp" | "grpc"
                }
                period={effectivePeriod}
                interval={interval}
                regions={selectedRegions}
              />
            )}
          </Section>
          <Section id="regions">
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
                <EmptyStateTitle>
                  Couldn&apos;t load region metrics
                </EmptyStateTitle>
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
        </>
      )}
      <Section id="timeline">
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
