import * as React from "react";
import { notFound } from "next/navigation";
import * as z from "zod";

import { flyRegions } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/tinybird";
import { Separator } from "@openstatus/ui";

import { getResponseGraphData, getResponseTimeMetricsData } from "@/lib/tb";
import { api } from "@/trpc/server";
import { ButtonReset } from "../_components/button-reset";
import { DatePickerPreset } from "../_components/date-picker-preset";
import { Metrics } from "../_components/metrics";
import {
  getDateByPeriod,
  getHoursByPeriod,
  getMinutesByInterval,
  intervals,
  periods,
  quantiles,
} from "../utils";
import { CombinedChartWrapper } from "./_components/combined-chart-wrapper";

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
  // fromDate: z.coerce
  //   .number()
  //   .optional()
  //   .default(startOfDay(new Date()).getTime()),
  // toDate: z.coerce.number().optional().default(endOfDay(new Date()).getTime()),
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

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor || !search.success) {
    return notFound();
  }

  const date = getDateByPeriod(search.data.period);
  const intervalMinutes = getMinutesByInterval(search.data.interval);
  const periodicityMinutes = getMinutesByInterval(monitor.periodicity);
  const periodicityHours = getHoursByPeriod(search.data.period);

  const isQuantileDisabled = intervalMinutes <= periodicityMinutes;
  const minutes = isQuantileDisabled ? periodicityMinutes : intervalMinutes;

  const data = await getResponseGraphData({
    monitorId: id,
    ...search.data,
    /**
     *
     */
    fromDate: date.from.getTime(),
    toDate: date.to.getTime(),
    interval: minutes,
  });

  const metrics = await getResponseTimeMetricsData({
    monitorId: id,
    interval: periodicityHours,
  });

  if (!data || !metrics) return null;

  const { period, quantile, interval, regions } = search.data;

  const isDirty =
    period !== DEFAULT_PERIOD ||
    quantile !== DEFAULT_QUANTILE ||
    interval !== DEFAULT_INTERVAL ||
    flyRegions.length !== regions.length;

  return (
    <div className="grid gap-4">
      <div className="flex justify-between gap-2">
        <DatePickerPreset period={period} />
        {isDirty ? <ButtonReset /> : null}
      </div>
      <Metrics metrics={metrics} period={period} />
      <Separator className="my-8" />
      <CombinedChartWrapper
        data={data}
        period={period}
        quantile={quantile}
        interval={interval}
        regions={regions as Region[]}
        monitor={monitor}
        isQuantileDisabled={isQuantileDisabled}
      />
    </div>
  );
}
