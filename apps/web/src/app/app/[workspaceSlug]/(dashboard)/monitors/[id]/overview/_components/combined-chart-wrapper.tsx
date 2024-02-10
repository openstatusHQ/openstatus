"use client";

import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";

import type { Monitor } from "@openstatus/db/src/schema";
import type {
  Region,
  ResponseGraph,
  ResponseTimeMetricsByRegion,
} from "@openstatus/tinybird";
import { Toggle } from "@openstatus/ui";

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
}: {
  data: ResponseGraph[];
  period: Period;
  quantile: Quantile;
  interval: Interval;
  regions: Region[];
  monitor: Monitor;
  isQuantileDisabled: boolean;
  metricsByRegion: ResponseTimeMetricsByRegion[];
}) {
  const chartData = useMemo(
    () => groupDataByTimestamp(data, period, quantile),
    [data, period, quantile],
  );
  const [combinedRegions, setCombinedRegions] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full gap-2 sm:flex-row sm:justify-between">
          <Toggle
            pressed={combinedRegions}
            onPressedChange={setCombinedRegions}
            variant="outline"
          >
            <LineChart className="mr-2 h-4 w-4" />
            {!combinedRegions ? "Combine regions" : "Split regions"}
          </Toggle>
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
