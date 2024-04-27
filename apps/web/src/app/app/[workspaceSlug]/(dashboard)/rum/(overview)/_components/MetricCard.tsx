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
      <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        {event}
      </p>
      <p className="text-tremor-content-strong dark:text-dark-tremor-content-strong text-3xl font-semibold">
        {data?.median || 0}
      </p>
    </Card>
  );
};
