import { Card } from "@tremor/react";

import { api } from "@/trpc/server";

export const RUMMetricCard = async ({
  event,
}: {
  event: "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB";
}) => {
  const data = await api.rumRouter.GetEventMetricsForWorkspace.query({
    event: event,
  });
  return (
    <Card>
      <p className="text-muted-foreground text-sm">{event}</p>
      <p className="text-foreground text-3xl font-semibold">
        {data?.median || 0}
      </p>
    </Card>
  );
};
