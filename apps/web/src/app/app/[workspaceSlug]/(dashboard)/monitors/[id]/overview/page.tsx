import * as React from "react";
import { notFound } from "next/navigation";
import { endOfDay, startOfDay } from "date-fns";
import * as z from "zod";

import { StatusDot } from "@/components/monitor/status-dot";
import { getResponseGraphData } from "@/lib/tb";
import { api } from "@/trpc/server";
import { DatePickerPreset } from "../_components/date-picker-preset";
import { IntervalPreset } from "../_components/interval-preset";
import { QuantilePreset } from "../_components/quantile-preset";
import {
  getDateByPeriod,
  getMinutesByInterval,
  intervals,
  periods,
  quantiles,
} from "../utils";
import { ChartWrapper } from "./_components/chart-wrapper";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  cronTimestamp: z.coerce.number().optional(),
  quantile: z.enum(quantiles).optional().default("p95"),
  interval: z.enum(intervals).optional().default("30m"),
  period: z.enum(periods).optional().default("1d"),
  fromDate: z.coerce
    .number()
    .optional()
    .default(startOfDay(new Date()).getTime()),
  toDate: z.coerce.number().optional().default(endOfDay(new Date()).getTime()),
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

  if (!data) return null;

  const { period, quantile, interval } = search.data;

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <StatusDot status={monitor.status} active={monitor.active} />
          <span>
            {monitor.active
              ? monitor.status === "active"
                ? "up"
                : "down"
              : "pause"}{" "}
            · checked every{" "}
            <code className="text-foreground">{monitor.periodicity}</code>
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {/* IDEA: add tooltip for description */}
        <DatePickerPreset period={period} />
        <QuantilePreset quantile={quantile} disabled={isQuantileDisabled} />
        <IntervalPreset interval={interval} />
      </div>
      <ChartWrapper period={period} quantile={quantile} data={data} />
      <p className="text-muted-foreground text-center text-xs">
        Select your preferred time range, percentile for insights, and time
        interval for granular analysis.
      </p>
    </div>
  );
}
