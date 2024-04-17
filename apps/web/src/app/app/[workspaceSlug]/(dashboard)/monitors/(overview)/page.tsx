import * as React from "react";
import Link from "next/link";

import { OSTinybird } from "@openstatus/tinybird";
import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/monitor/columns";
import { DataTable } from "@/components/data-table/monitor/data-table";
import { env } from "@/env";
import { api } from "@/trpc/server";
import RefreshRoute from "../_components/refresh-route";

// import { RefreshWidget } from "../_components/refresh-widget";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const monitors = await api.monitor.getMonitorsByWorkspace.query();
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();

  if (monitors?.length === 0)
    return (
      <EmptyState
        icon="activity"
        title="No monitors"
        description="Create your first monitor"
        action={
          <Button asChild>
            <Link href="./monitors/new">Create</Link>
          </Button>
        }
      />
    );

  const _incidents = await api.incident.getIncidentsByWorkspace.query();
  const tags = await api.monitorTag.getMonitorTagsByWorkspace.query();

  // maybe not very efficient?
  // use Suspense and Client call instead?
  const monitorsWithData = await Promise.all(
    monitors.map(async (monitor) => {
      const metrics = await tb.endpointMetrics("1d")(
        {
          monitorId: String(monitor.id),
        },
        { cache: "no-store", revalidate: 0 },
      );

      const data = await tb.endpointStatusPeriod("7d")(
        {
          monitorId: String(monitor.id),
        },
        { cache: "no-store", revalidate: 0 },
      );

      const [current] = metrics?.sort((a, b) =>
        (a.lastTimestamp || 0) - (b.lastTimestamp || 0) < 0 ? 1 : -1,
      ) || [undefined];

      const incidents = _incidents.filter(
        (incident) => incident.monitorId === monitor.id,
      );

      const tags = monitor.monitorTagsToMonitors.map(
        ({ monitorTag }) => monitorTag,
      );

      return { monitor, metrics: current, data, incidents, tags };
    }),
  );

  // const lastCronTimestamp = monitorsWithData?.reduce((prev, acc) => {
  //   const lastTimestamp = acc.metrics?.lastTimestamp || 0;
  //   if (lastTimestamp > prev) return lastTimestamp;
  //   return prev;
  // }, 0);

  return (
    <>
      <DataTable columns={columns} data={monitorsWithData} tags={tags} />
      {isLimitReached ? <Limit /> : null}
      <RefreshRoute />
      {/* <RefreshWidget defaultValue={lastCronTimestamp} /> */}
    </>
  );
}
