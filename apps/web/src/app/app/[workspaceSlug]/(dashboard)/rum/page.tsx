import * as React from "react";
import { notFound } from "next/navigation";

import { api } from "@/trpc/server";
import { RUMMetricCard } from "./(overview)/_components/MetricCard";

export const dynamic = "force-dynamic";

export default async function RUMPage() {
  const workspace = await api.workspace.getWorkspace.query();

  if (!workspace) {
    return notFound();
  }
  if (workspace.dsn === null) {
    return <>The feature is currently in beta and will be released soon.</>;
  }
  return (
    <div className="grid  grid-cols-1 gap-2 md:grid-cols-4">
      <RUMMetricCard event="CLS" />
      <RUMMetricCard event="FCP" />
      <RUMMetricCard event="FID" />
      <RUMMetricCard event="INP" />
      <RUMMetricCard event="LCP" />
      <RUMMetricCard event="TTFB" />
    </div>
  );
}
