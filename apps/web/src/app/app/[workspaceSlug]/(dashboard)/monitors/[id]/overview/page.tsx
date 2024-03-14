import * as React from "react";
import { notFound } from "next/navigation";
import * as z from "zod";

import { flyRegions } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/tinybird";
import { OSTinybird } from "@openstatus/tinybird";
import { Separator } from "@openstatus/ui";

import { env } from "@/env";
import { getPreferredSettings } from "@/lib/preferred-settings/server";
import { api } from "@/trpc/server";
import { ButtonReset } from "../_components/button-reset";
import { DatePickerPreset } from "../_components/date-picker-preset";
import { Metrics } from "../_components/metrics";
import { getMinutesByInterval, intervals, periods, quantiles } from "../utils";
import { CombinedChartWrapper } from "./_components/combined-chart-wrapper";

// import { groupDataByTimestamp } from "./_components/utils";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

const DEFAULT_QUANTILE = "p95";
const DEFAULT_INTERVAL = "30m";
const DEFAULT_PERIOD = "1d";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  cronTimestamp: z.coerce.number().optional(),
  quantile: z.enum(quantiles).optional().default(DEFAULT_QUANTILE),
  interval: z.enum(intervals).optional().default(DEFAULT_INTERVAL),
  period: z.enum(periods).optional().default(DEFAULT_PERIOD),
  regions: z
    .string()
    .optional()
    .transform(
      (value) =>
        value
          ?.trim()
          ?.split(",")
          .filter((i) => flyRegions.includes(i as Region)) ?? flyRegions,
    ),
});

export default async function Page({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string; id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const id = params.id;
  const search = searchParamsSchema.safeParse(searchParams);
  const preferredSettings = getPreferredSettings();

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor || !search.success) {
    return notFound();
  }

  const { period, quantile, interval, regions } = search.data;

  // TODO: work it out easier
  const intervalMinutes = getMinutesByInterval(interval);
  const periodicityMinutes = getMinutesByInterval(monitor.periodicity);

  const isQuantileDisabled = intervalMinutes <= periodicityMinutes;
  const minutes = isQuantileDisabled ? periodicityMinutes : intervalMinutes;

  const metrics = await tb.endpointMetrics(period)({
    monitorId: id,
    url: monitor.url,
  });

  const data = await tb.endpointChart(period)({
    monitorId: id,
    url: monitor.url,
    interval: minutes,
  });

  const metricsByRegion = await tb.endpointMetricsByRegion(period)({
    monitorId: id,
    url: monitor.url,
  });

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
      <Metrics metrics={metrics} period={period} />
      <Separator className="my-8" />
      <CombinedChartWrapper
        data={data}
        period={period}
        quantile={quantile}
        interval={interval}
        regions={regions as Region[]} // FIXME: not properly reseted after filtered
        monitor={monitor}
        isQuantileDisabled={isQuantileDisabled}
        metricsByRegion={metricsByRegion}
        preferredSettings={preferredSettings}
      />
    </div>
  );
}
