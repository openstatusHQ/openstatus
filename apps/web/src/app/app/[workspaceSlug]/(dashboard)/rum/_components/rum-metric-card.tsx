import { Card } from "@tremor/react";

import { webVitalsConfig } from "@openstatus/rum";
import type { WebVitalEvents } from "@openstatus/rum";

import { api } from "@/trpc/server";

export const RUMMetricCard = async ({ event }: { event: WebVitalEvents }) => {
  const data = await api.rumRouter.GetEventMetricsForWorkspace.query({ event });
  const eventConfig = webVitalsConfig[event];
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        {eventConfig.label} ({event})
      </p>
      <p className="text-foreground text-3xl font-semibold">
        {data?.median || 0}
      </p>
    </Card>
  );
};
