import { notFound } from "next/navigation";

import {
  type Region,
  monitorRegions,
} from "@openstatus/db/src/schema/constants";
import { Separator } from "@openstatus/ui/src/components/separator";

import { Header } from "@/components/dashboard/header";
import { CombinedChartWrapper } from "@/components/monitor-charts/combined-chart-wrapper";
import { ButtonReset } from "@/components/monitor-dashboard/button-reset";
import { DatePickerPreset } from "@/components/monitor-dashboard/date-picker-preset";
import { Metrics } from "@/components/monitor-dashboard/metrics";
import { getMinutesByInterval } from "@/lib/monitor/utils";
import { getPreferredSettings } from "@/lib/preferred-settings/server";
import {
  prepareMetricByIntervalByPeriod,
  prepareMetricByRegionByPeriod,
  prepareMetricsByPeriod,
} from "@/lib/tb";
import { api } from "@/trpc/server";
import type { Metadata } from "next";
import {
  DEFAULT_INTERVAL,
  DEFAULT_PERIOD,
  DEFAULT_QUANTILE,
  periods,
  searchParamsCache,
} from "./search-params";

export const revalidate = 120;

/**
 * Workspace slugs that should have the URL hidden
 */
const WORKSPACES_HIDE_URL =
  process.env.WORKSPACES_HIDE_URL?.split(",").map(Number) || [];

export async function generateMetadata(props: {
  params: Promise<{ domain: string; id: string }>;
}): Promise<Metadata> {
  const { domain, id } = await props.params;
  const monitor = await api.monitor.getPublicMonitorById.query({
    id: Number(id),
    slug: domain,
  });

  if (!monitor) return notFound();

  return { title: monitor.name };
}

export default async function Page(props: {
  params: Promise<{ domain: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const id = params.id;
  const search = searchParamsCache.parse(searchParams);
  const preferredSettings = getPreferredSettings();

  const monitor = await api.monitor.getPublicMonitorById.query({
    id: Number(id),
    slug: params.domain,
  });

  if (!monitor) return notFound();

  const { period, quantile, interval, regions } = search;
  const type = monitor.jobType as "http" | "tcp";

  // TODO: work it out easier
  const intervalMinutes = getMinutesByInterval(interval);
  const periodicityMinutes = getMinutesByInterval(monitor.periodicity);

  const isQuantileDisabled = intervalMinutes <= periodicityMinutes;
  const minutes = isQuantileDisabled ? periodicityMinutes : intervalMinutes;

  const hideURL =
    monitor.workspaceId && WORKSPACES_HIDE_URL.includes(monitor.workspaceId);

  const [metrics, data, metricsByRegion] = await Promise.all([
    prepareMetricsByPeriod(period, type).getData({
      monitorId: id,
      regions: monitor.regions,
    }),
    prepareMetricByIntervalByPeriod(period, type).getData({
      monitorId: id,
      interval: minutes,
      regions: monitor.regions,
    }),
    prepareMetricByRegionByPeriod(period, type).getData({
      monitorId: id,
      regions: monitor.regions,
    }),
  ]);

  if (!data || !metrics || !metricsByRegion) return null;

  const isDirty =
    period !== DEFAULT_PERIOD ||
    quantile !== DEFAULT_QUANTILE ||
    interval !== DEFAULT_INTERVAL ||
    monitorRegions.length !== regions.length;

  return (
    <div className="relative flex w-full flex-col gap-6">
      <Header
        title={monitor.name}
        description={hideURL ? undefined : monitor.url}
      />
      <div className="flex items-center justify-between gap-2">
        <DatePickerPreset defaultValue={period} values={periods} />
        {isDirty ? <ButtonReset /> : null}
      </div>
      <Metrics metrics={metrics.data} period={period} />
      <Separator className="my-8" />
      <CombinedChartWrapper
        data={data.data}
        period={period}
        quantile={quantile}
        interval={interval}
        regions={regions.length ? (regions as Region[]) : monitor.regions} // FIXME: not properly reseted after filtered
        monitor={{ ...monitor, url: hideURL ? "" : monitor.url }}
        isQuantileDisabled={isQuantileDisabled}
        metricsByRegion={metricsByRegion.data}
        preferredSettings={preferredSettings}
      />
    </div>
  );
}
