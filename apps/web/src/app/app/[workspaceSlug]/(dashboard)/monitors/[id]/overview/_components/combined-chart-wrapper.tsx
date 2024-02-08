"use client";

import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";

import type { Monitor } from "@openstatus/db/src/schema";
import type { Region, ResponseGraph } from "@openstatus/tinybird";
import { Toggle } from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";

import { EmptyState } from "@/components/dashboard/empty-state";
import { IntervalPreset } from "../../_components/interval-preset";
import { QuantilePreset } from "../../_components/quantile-preset";
import { RegionsPreset } from "../../_components/region-preset";
import type { Interval, Period, Quantile } from "../../utils";
import { Chart } from "./chart";
import { SimpleChart } from "./simple-chart";
import { groupDataByTimestamp } from "./utils";

export function CombinedChartWrapper({
  data,
  period,
  quantile,
  interval,
  regions,
  monitor,
  isQuantileDisabled,
}: {
  data: ResponseGraph[];
  period: Period;
  quantile: Quantile;
  interval: Interval;
  regions: Region[];
  monitor: Monitor;
  isQuantileDisabled: boolean;
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
            Combine Regions
          </Toggle>
          <RegionsPreset
            regions={monitor.regions as Region[]}
            selectedRegions={regions as Region[]}
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
          <div className="grid gap-1">
            {chartData.regions
              // TODO: use flyRegions instead of hardcoded regions
              // FIXME: fix the type
              .filter((region) => regions.includes(region as Region))
              .map((region) => {
                const { code, flag } =
                  flyRegionsDict[region as keyof typeof flyRegionsDict];
                return (
                  <div key={region} className="flex items-center gap-2">
                    <div className="w-24">
                      <p className="font-mono">
                        {flag} {code}
                      </p>
                    </div>
                    <SimpleChart data={chartData.data} region={region} />
                  </div>
                );
              })}
          </div>
        )}
        {regions.length > 0 ? null : (
          <EmptyState
            icon="activity"
            title="No regions selected"
            description="Select at least one region to display the data."
          />
        )}
      </div>
    </>
  );
}
