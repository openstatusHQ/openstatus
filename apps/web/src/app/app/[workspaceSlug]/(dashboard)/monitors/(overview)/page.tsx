import * as React from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/monitor/columns";
import { DataTable } from "@/components/data-table/monitor/data-table";
import { getMonitorListData, getResponseTimeMetricsData } from "@/lib/tb";
import { convertTimezoneToGMT } from "@/lib/timezone";
import { api } from "@/trpc/server";

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

  const gmt = convertTimezoneToGMT();

  const _incidents = await api.incident.getAllIncidents.query();

  // maybe not very efficient?
  // use Suspense and Client call instead?
  const monitorsWithData = await Promise.all(
    monitors.map(async (monitor) => {
      const metrics = await getResponseTimeMetricsData({
        monitorId: String(monitor.id),
        url: monitor.url,
        interval: 24,
      });

      const data = await getMonitorListData({
        monitorId: String(monitor.id),
        url: monitor.url,
        timezone: gmt,
      });

      const [current, _] = metrics
        ? metrics.sort((a, b) => (a.time - b.time < 0 ? 1 : -1))
        : [undefined];

      const incidents = _incidents.filter(
        (incident) => incident.monitorId === monitor.id,
      );

      return { monitor, metrics: current, data, incidents };
    }),
  );

  return (
    <>
      <DataTable columns={columns} data={monitorsWithData} />
      {isLimitReached ? <Limit /> : null}
    </>
  );
}
