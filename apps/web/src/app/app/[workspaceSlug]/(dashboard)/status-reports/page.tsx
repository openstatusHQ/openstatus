import * as React from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { HelpCallout } from "@/components/dashboard/help-callout";
import { columns } from "@/components/data-table/status-report/columns";
import { DataTable } from "@/components/data-table/status-report/data-table";
import { api } from "@/trpc/server";
import { EmptyState } from "./_components/empty-state";

export default async function StatusReportsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const reports = await api.statusReport.getStatusReportByWorkspace.query();
  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto,1fr,auto] gap-6 md:grid-cols-1 md:gap-8">
      <Header
        title="Status Reports"
        description="Overview of all your status reports and updates."
        actions={
          <Button asChild>
            <Link href="./status-reports/edit">Create</Link>
          </Button>
        }
      />
      {Boolean(reports?.length) ? (
        <div className="col-span-full">
          <DataTable columns={columns} data={reports} />
        </div>
      ) : (
        <div className="col-span-full">
          <EmptyState />
        </div>
      )}
      <div className="mt-8 md:mt-12">
        <HelpCallout />
      </div>
    </div>
  );
}
