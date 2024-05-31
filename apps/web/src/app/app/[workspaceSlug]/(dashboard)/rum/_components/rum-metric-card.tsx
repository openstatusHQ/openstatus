import { getColorByType } from "@openstatus/rum";
import type { WebVitalsValues } from "@openstatus/rum";

import { api } from "@/trpc/server";
import { RUMCard } from "./rum-card";

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
