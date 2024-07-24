import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";
import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/monitor/columns";
import { DataTable } from "@/components/data-table/monitor/data-table";
import { env } from "@/env";
import { api } from "@/trpc/server";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  tags: z
    .string()
    .transform((v) => v?.split(","))
    .optional(),
  public: z
    .string()
    .transform((v) =>
      v?.split(",").map((v) => {
        if (v === "true") return true;
        if (v === "false") return false;
        return undefined;
      }),
    )
    .optional(),
  pageSize: z.coerce.number().optional().default(10),
  pageIndex: z.coerce.number().optional().default(0),
});

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const monitors = await api.monitor.getMonitorsByWorkspace.query();
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();

  if (!search.success) return notFound();

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

  const _incidents = await api.incident.getIncidentsByWorkspace.query(); // TODO: filter by last 7 days
  const tags = await api.monitorTag.getMonitorTagsByWorkspace.query();
  const _maintenances = await api.maintenance.getLast7DaysByWorkspace.query();

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

      const maintenances = _maintenances.filter((maintenance) =>
        maintenance.monitors.includes(monitor.id),
      );

      return {
        monitor,
        metrics: current,
        data,
        incidents,
        maintenances,
        tags,
        isLimitReached,
      };
    }),
  );

  return (
    <>
      <DataTable
        defaultColumnFilters={[
          { id: "tags", value: search.data.tags },
          { id: "public", value: search.data.public },
        ].filter((v) => v.value !== undefined)}
        columns={columns}
        data={monitorsWithData}
        tags={tags}
        defaultPagination={{
          pageIndex: search.data.pageIndex,
          pageSize: search.data.pageSize,
        }}
      />
      {isLimitReached ? <Limit /> : null}
    </>
  );
}
