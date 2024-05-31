import { Card } from "@tremor/react";

import { getColorByType, webVitalsConfig } from "@openstatus/rum";
import type { WebVitalEvents, WebVitalsValues } from "@openstatus/rum";

import { api } from "@/trpc/server";
import { CategoryBar } from "./category-bar";

function prepareWebVitalValues(values: WebVitalsValues) {
  return values.map((value) => ({
    ...value,
    color: getColorByType(value.type),
  }));
}

export const RUMCard = async ({
  event,
  value,
}: {
  event: WebVitalEvents;
  value: number;
}) => {
  const eventConfig = webVitalsConfig[event];
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        {eventConfig.label} ({event})
      </p>
      <p className="font-semibold text-3xl text-foreground">
        {event !== "CLS" ? value.toFixed(0) : value.toFixed(2) || 0}
      </p>
      <CategoryBar
        values={prepareWebVitalValues(eventConfig.values)}
        marker={value || 0}
      />
    </Card>
  );
};

export const RUMMetricCards = async ({ dsn }: { dsn: string }) => {
  const data = await api.tinybird.totalRumMetricsForApplication.query({
    dsn: dsn,
    period: "24h",
  });
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-5 md:grid-cols-2">
      <RUMCard event="CLS" value={data?.cls || 0} />
      <RUMCard event="FCP" value={data?.fcp || 0} />
      <RUMCard event="INP" value={data?.inp || 0} />

      <RUMCard event="LCP" value={data?.lcp || 0} />
      <RUMCard event="TTFB" value={data?.ttfb || 0} />
    </div>
  );
};
