import * as React from "react";
import Link from "next/link";

import { allPlans } from "@openstatus/plans";
import { ButtonWithDisableTooltip } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { HelpCallout } from "@/components/dashboard/help-callout";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/monitor/columns";
import { DataTable } from "@/components/data-table/monitor/data-table";
import { getResponseListData } from "@/lib/tb";
import { api } from "@/trpc/server";
import { EmptyState } from "./_components/empty-state";

export default async function MonitorPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });
  const workspace = await api.workspace.getWorkspace.query({
    slug: params.workspaceSlug,
  });

  const isLimit =
    (monitors?.length || 0) >=
    allPlans[workspace?.plan || "free"].limits.monitors;

  async function getMonitorLastStatusCode(monitorId: string) {
    const ping = await getResponseListData({
      monitorId,
      page_size: 1,
    });
    const lastStatusCode = ping && ping.length > 0 ? ping[0].statusCode : 0;
    return lastStatusCode;
  }

  const lastStatusCodes = (
    await Promise.allSettled(
      monitors?.map((monitor) =>
        getMonitorLastStatusCode(String(monitor.id)),
      ) || [],
    )
  ).map((code) => (code.status === "fulfilled" && code.value) || 0);

  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto,1fr,auto] gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Monitors"
        description="Overview of all your monitors."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!isLimit}
            disabled={isLimit}
          >
            <Link href="./monitors/edit">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      {Boolean(monitors?.length) ? (
        <div className="col-span-full">
          {monitors && (
            <DataTable
              columns={columns}
              data={monitors.map((_, i) => ({
                ..._,
                lastStatusCode: lastStatusCodes[i],
              }))}
            />
          )}
        </div>
      ) : (
        <div className="col-span-full">
          <EmptyState />
          <div className="mt-3">{isLimit ? <Limit /> : null}</div>
        </div>
      )}
      <div className="mt-8 md:mt-12">
        <HelpCallout />
      </div>
    </div>
  );
}
