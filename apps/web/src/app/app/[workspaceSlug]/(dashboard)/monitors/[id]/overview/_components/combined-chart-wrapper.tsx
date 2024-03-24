"use client";

import { LineChart } from "lucide-react";
import { useMemo } from "react";

import type { Monitor } from "@openstatus/db/src/schema";
import type {
  Region,
  ResponseGraph,
  ResponseTimeMetricsByRegion,
} from "@openstatus/tinybird";
import { Toggle } from "@openstatus/ui";

import { usePreferredSettings } from "@/lib/preferred-settings/client";
import type { PreferredSettings } from "@/lib/preferred-settings/server";
import { IntervalPreset } from "../../_components/interval-preset";
import { QuantilePreset } from "../../_components/quantile-preset";
import { RegionsPreset } from "../../_components/region-preset";
import type { Interval, Period, Quantile } from "../../utils";
import { Chart } from "./chart";
import { RegionTable } from "./region-table";
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
  monitor: Monitor;
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
      <div className="grid gap-3">
        {combinedRegions ? (
          <Chart data={chartData.data} regions={regions} />
        ) : (
          <RegionTable
            metricsByRegion={metricsByRegion}
            regions={regions}
            data={chartData}
          />
        )}
      </div>
    </>
  );
}
