"use client";

import { LineChart } from "lucide-react";
import { useMemo } from "react";

import type { Monitor, PublicMonitor } from "@openstatus/db/src/schema";

import { Toggle } from "@openstatus/ui";

import { columns } from "@/components/data-table/single-region/columns";
import { DataTable } from "@/components/data-table/single-region/data-table";
import { IntervalPreset } from "@/components/monitor-dashboard/interval-preset";
import { QuantilePreset } from "@/components/monitor-dashboard/quantile-preset";
import { RegionsPreset } from "@/components/monitor-dashboard/region-preset";
import type { Interval, Period, Quantile } from "@/lib/monitor/utils";
import { usePreferredSettings } from "@/lib/preferred-settings/client";
import type { PreferredSettings } from "@/lib/preferred-settings/server";
import type { ResponseGraph, ResponseTimeMetricsByRegion } from "@/lib/tb";
import type { Region } from "@openstatus/db/src/schema/constants";
import { Chart } from "./chart";
import { groupDataByTimestamp } from "./utils";

export function CombinedChartWrapper({
  data,
  period,
  quantile,
  interval,
  regions,
  monitor,
  isQuantileDisabled,
  metricsByRegion,
  preferredSettings: defaultPreferredSettings,
}: {
  data: ResponseGraph[];
  period: Period;
  quantile: Quantile;
  interval: Interval;
  regions: Region[];
  monitor: Monitor | PublicMonitor;
  isQuantileDisabled: boolean;
  metricsByRegion: ResponseTimeMetricsByRegion[];
  preferredSettings: PreferredSettings;
}) {
  const chartData = useMemo(
    () => groupDataByTimestamp(data, period, quantile),
    [data, period, quantile],
  );

  const [preferredSettings, setPreferredSettings] = usePreferredSettings(
    defaultPreferredSettings,
  );

  const combinedRegions = preferredSettings?.combinedRegions ?? false;

  const tableData = useMemo(
    () =>
      regions
        .map((region) => ({
          region,
          data: chartData.data,
          metrics: metricsByRegion.find((metrics) => metrics.region === region),
        }))
        .filter((row) => !!row.metrics),
    [regions, chartData, metricsByRegion],
  );

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full items-end gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">Change the view</p>
            <Toggle
              pressed={combinedRegions}
              onPressedChange={(value) => {
                setPreferredSettings({ combinedRegions: value });
              }}
              variant="outline"
              className="w-max"
            >
              <LineChart className="mr-2 h-4 w-4" />
              {!combinedRegions ? "Combine regions" : "Split regions"}
            </Toggle>
          </div>
          <RegionsPreset
            regions={monitor.regions as Region[]}
            selectedRegions={regions}
          />
        </div>
        <div className="flex gap-2">
          <QuantilePreset quantile={quantile} disabled={isQuantileDisabled} />
          {/* TODO: add a minInterval and disabled for the once having e.g. only 30min monitor.periodicity */}
          <IntervalPreset interval={interval} />
        </div>
      </div>
      <div>
        {combinedRegions ? (
          <Chart data={chartData.data} regions={regions} />
        ) : (
          <DataTable columns={columns} data={tableData} />
        )}
      </div>
    </>
  );
}
