import Link from "next/link";

import { OSTinybird } from "@openstatus/tinybird";
import { Button } from "@openstatus/ui/src/components/button";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/monitor/columns";
import { DataTable } from "@/components/data-table/monitor/data-table";
import { env } from "@/env";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsCache.parse(searchParams);

  const monitors = await api.monitor.getMonitorsByWorkspace.query();
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

  const [_incidents, tags, _maintenances, isLimitReached] = await Promise.all([
    api.incident.getIncidentsByWorkspace.query(),
    api.monitorTag.getMonitorTagsByWorkspace.query(),
    api.maintenance.getLast7DaysByWorkspace.query(),
    api.monitor.isMonitorLimitReached.query(),
  ]);

  // TODO: TCP

  // maybe not very efficient?
  // use Suspense and Client call instead?
  const monitorsWithData = await Promise.all(
    monitors.map(async (monitor) => {
      const [metrics, data] = await Promise.all([
        tb.httpMetricsDaily({
          monitorId: String(monitor.id),
        }),
        tb.httpStatusWeekly({
          monitorId: String(monitor.id),
        }),
      ]);

      const [current] = metrics.data?.sort((a, b) =>
        (a.lastTimestamp || 0) - (b.lastTimestamp || 0) < 0 ? 1 : -1
      ) || [undefined];

      const incidents = _incidents.filter(
        (incident) => incident.monitorId === monitor.id
      );

      const tags = monitor.monitorTagsToMonitors.map(
        ({ monitorTag }) => monitorTag
      );

      const maintenances = _maintenances.filter((maintenance) =>
        maintenance.monitors.includes(monitor.id)
      );

      return {
        monitor,
        metrics: current,
        data: data.data,
        incidents,
        maintenances,
        tags,
        isLimitReached,
      };
    })
  );

  return (
    <>
      <DataTable
        defaultColumnFilters={[
          { id: "tags", value: search.tags },
          { id: "public", value: search.public },
        ].filter((v) => v.value !== null)}
        columns={columns}
        data={monitorsWithData}
        tags={tags}
        defaultPagination={{
          pageIndex: search.pageIndex,
          pageSize: search.pageSize,
        }}
      />
      {isLimitReached ? <Limit /> : null}
    </>
  );
}
