import Link from "next/link";
import * as React from "react";

import { Button } from "@openstatus/ui/src/components/button";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/status-page/columns";
import { DataTable } from "@/components/data-table/status-page/data-table";
import { api } from "@/trpc/server";
import { StatusReportButton } from "./_components/status-report-button";

export default async function MonitorPage() {
  const pages = await api.page.getPagesByWorkspace.query();

  if (pages?.length === 0) {
    return (
      <EmptyState
        icon="panel-top"
        title="No pages"
        description="Create your first page"
        action={
          <Button asChild>
            <Link href="./status-pages/new">Create</Link>
          </Button>
        }
      />
    );
  }
  const isLimitReached = await api.page.isPageLimitReached.query();

  return (
    <>
      <DataTable columns={columns} data={pages} />
      {isLimitReached ? <Limit /> : null}
      <StatusReportButton pages={pages} />
    </>
  );
}
