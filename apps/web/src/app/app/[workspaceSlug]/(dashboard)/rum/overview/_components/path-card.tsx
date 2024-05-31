import { api } from "@/trpc/client";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { RUMCard } from "../../_components/rum-metric-card";

export const PathCard = ({ dsn }: { dsn: string }) => {
  const searchParams = useSearchParams();

  const path = searchParams.get("path");

  if (!path) {
    return null;
  }
  const data = use(
    api.tinybird.rumMetricsForPath.query({
      dsn,
      path,
      period: "24h",
    })
  );

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
