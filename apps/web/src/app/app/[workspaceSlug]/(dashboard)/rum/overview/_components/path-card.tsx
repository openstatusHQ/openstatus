import { api } from "@/trpc/server";
import { RUMCard } from "../../_components/rum-card";

export const PathCard = async ({
  dsn,
  path,
}: {
  dsn: string;
  path: string;
}) => {
  if (!path) {
    return null;
  }

  const data = await api.tinybird.rumMetricsForPath.query({
    dsn,
    path,
    period: "24h",
  });
  if (!data) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
      <RUMCard event="CLS" value={data?.cls || 0} />
      <RUMCard event="FCP" value={data?.fcp || 0} />
      <RUMCard event="INP" value={data?.inp || 0} />

      <RUMCard event="LCP" value={data?.lcp || 0} />
      <RUMCard event="TTFB" value={data?.ttfb || 0} />
    </div>
  );
};
