import * as React from "react";
import Link from "next/link";

import { allPlans } from "@openstatus/plans";
import { ButtonWithDisableTooltip } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { HelpCallout } from "@/components/dashboard/help-callout";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/status-page/columns";
import { DataTable } from "@/components/data-table/status-page/data-table";
import { api } from "@/trpc/server";
import { EmptyState } from "./_components/empty-state";

// export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const pages = await api.page.getPagesByWorkspace.query();
  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  const workspace = await api.workspace.getWorkspace.query();

  const isLimit =
    (pages?.length || 0) >=
    allPlans[workspace?.plan || "free"].limits["status-pages"];

  const disableButton = isLimit || !Boolean(monitors);

  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto,1fr,auto] gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Page"
        description="Overview of all your status pages."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!disableButton}
            disabled={disableButton}
          >
            <Link href="./status-pages/edit">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      {Boolean(pages?.length) ? (
        <div className="col-span-full">
          {pages && <DataTable columns={columns} data={pages} />}
          <div className="mt-3">{isLimit ? <Limit /> : null}</div>
        </div>
      ) : (
        <div className="col-span-full">
          <EmptyState allMonitors={monitors} />
        </div>
      )}
      <div className="mt-8 md:mt-12">
        <HelpCallout />
      </div>
    </div>
  );
}
