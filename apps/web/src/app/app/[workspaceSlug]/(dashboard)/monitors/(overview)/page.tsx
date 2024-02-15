import * as React from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/monitor/columns";
import { DataTable } from "@/components/data-table/monitor/data-table";
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

  return (
    <>
      <DataTable columns={columns} data={monitors} />
      {isLimitReached ? <Limit /> : null}
    </>
  );
}
