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

export const RUMMetricCard = async ({ event }: { event: WebVitalEvents }) => {
  const data = await api.rumRouter.GetEventMetricsForWorkspace.query({ event });
  const eventConfig = webVitalsConfig[event];
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        {eventConfig.label} ({event})
      </p>
      <p className="font-semibold text-3xl text-foreground">
        {data?.median.toFixed(2) || 0}
      </p>
      <CategoryBar
        values={prepareWebVitalValues(eventConfig.values)}
        marker={data?.median || 0}
      />
    </Card>
  );
};
