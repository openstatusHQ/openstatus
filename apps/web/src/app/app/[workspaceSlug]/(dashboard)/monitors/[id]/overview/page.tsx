import { notFound } from "next/navigation";
import * as React from "react";

import { type Region, flyRegions } from "@openstatus/db/src/schema/constants";
import { Separator } from "@openstatus/ui";

import { CombinedChartWrapper } from "@/components/monitor-charts/combined-chart-wrapper";
import { ButtonReset } from "@/components/monitor-dashboard/button-reset";
import { DatePickerPreset } from "@/components/monitor-dashboard/date-picker-preset";
import { Metrics } from "@/components/monitor-dashboard/metrics";
import { getMinutesByInterval, periods } from "@/lib/monitor/utils";
import { getPreferredSettings } from "@/lib/preferred-settings/server";
import {
  prepareMetricByIntervalByPeriod,
  prepareMetricByRegionByPeriod,
  prepareMetricsByPeriod,
} from "@/lib/tb";
import { api } from "@/trpc/server";
import {
  DEFAULT_INTERVAL,
  DEFAULT_PERIOD,
  DEFAULT_QUANTILE,
  searchParamsCache,
} from "./search-params";

export default async function Page(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const id = params.id;
  const search = searchParamsCache.parse(searchParams);

  const preferredSettings = getPreferredSettings();

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor) return notFound();

  const { period, quantile, interval, regions } = search;
  const type = monitor.jobType as "http" | "tcp";

  // TODO: work it out easier
  const intervalMinutes = getMinutesByInterval(interval);
  const periodicityMinutes = getMinutesByInterval(monitor.periodicity);

  const isQuantileDisabled = intervalMinutes <= periodicityMinutes;
  const minutes = isQuantileDisabled ? periodicityMinutes : intervalMinutes;

  const [metrics, data, metricsByRegion] = await Promise.all([
    prepareMetricsByPeriod(period, type).getData({
      monitorId: id,
    }),
    prepareMetricByIntervalByPeriod(period, type).getData({
      monitorId: id,
      interval: minutes,
    }),
    prepareMetricByRegionByPeriod(period, type).getData({
      monitorId: id,
    }),
  ]);

  if (!data || !metrics || !metricsByRegion) return null;

  const isDirty =
    period !== DEFAULT_PERIOD ||
    quantile !== DEFAULT_QUANTILE ||
    interval !== DEFAULT_INTERVAL ||
    flyRegions.length !== regions.length;

  // GET VALUES FOR BLOG POST
  // console.log(
  //   JSON.stringify({
  //     regions,
  //     data: groupDataByTimestamp(data, period, quantile),
  //     metricsByRegion,
  //   }),
  // );

  return (
    <div className="grid gap-4">
      <div className="flex justify-between gap-2">
        <DatePickerPreset defaultValue={period} values={periods} />
        {isDirty ? <ButtonReset /> : null}
      </div>
      <Metrics metrics={metrics.data} period={period} showErrorLink />
      <Separator className="my-8" />
      <CombinedChartWrapper
        data={data.data}
        period={period}
        quantile={quantile}
        interval={interval}
        regions={regions.length ? (regions as Region[]) : monitor.regions} // FIXME: not properly reseted after filtered
        monitor={monitor}
        isQuantileDisabled={isQuantileDisabled}
        metricsByRegion={metricsByRegion.data}
        preferredSettings={preferredSettings}
      />
    </div>
  );
}
