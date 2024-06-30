import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";

import { Button, Separator } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Events } from "@/components/status-update/events";
import { Summary } from "@/components/status-update/summary";
import { api } from "@/trpc/server";

export default async function OverviewPage({
  params,
}: {
  params: { workspaceSlug: string; reportId: string };
}) {
  const report = await api.statusReport.getStatusReportById.query({
    id: Number.parseInt(params.reportId),
  });

  if (!report) return notFound();

  const monitors = report.monitorsToStatusReports.map(({ monitor }) => monitor);

  return (
    <>
      <Summary report={report} monitors={monitors} />
      <Separator className="-my-2" />
      {report.statusReportUpdates.length > 0 ? (
        <Events statusReportUpdates={report.statusReportUpdates} editable />
      ) : (
        <EmptyState
          icon="megaphone"
          title="No status report updates"
          description="Create your first update"
          action={
            <Button asChild>
              {/* TODO: check if correct */}
              <Link href={`./${report.id}/update/edit`}>Create</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
