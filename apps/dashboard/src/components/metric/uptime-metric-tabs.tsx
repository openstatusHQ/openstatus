"use client";

import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";

import {
  HISTORY_METRICS,
  type HistoryMetric,
} from "@/data/status-page-history";

export function UptimeMetricTabs({
  value,
  onValueChange,
}: {
  value: HistoryMetric;
  /** null for the default, so the search param drops out of the URL */
  onValueChange: (value: HistoryMetric | null) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v === "runs" ? "runs" : null)}
    >
      <TabsList>
        {HISTORY_METRICS.map((m) => (
          <TabsTrigger key={m} value={m} className="capitalize">
            {m}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
