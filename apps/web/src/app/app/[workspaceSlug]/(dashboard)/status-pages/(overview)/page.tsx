import * as React from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/status-page/columns";
import { DataTable } from "@/components/data-table/status-page/data-table";
import { api } from "@/trpc/server";

export default async function MonitorPage() {
  const pages = await api.page.getPagesByWorkspace.query();
  const isLimitReached = await api.page.isPageLimitReached.query();

  if (pages?.length === 0)
    return (
      <EmptyState
        icon="panel-top"
        title="No pages"
        description="Create your first page"
        action={
          <Button asChild>
            <Link href="./page/new">Create</Link>
          </Button>
        }
      />
    );

  return (
    <>
      <DataTable columns={columns} data={pages} />
      <div className="mt-3">{isLimitReached ? <Limit /> : null}</div>
    </>
  );
}
