import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, Separator } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { Events } from "@/components/status-update/events";
import { Summary } from "@/components/status-update/summary";
import { api } from "@/trpc/server";
import { EmptyState } from "./_components/empty-state";
import Loading from "./loading";

export default async function StatusReportsPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const report = await api.statusReport.getStatusReportById.query({
    id: parseInt(params.id),
  });

  if (!report) return notFound();

  const monitors = report.monitorsToStatusReports.map(({ monitor }) => monitor);

  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto,1fr,auto] gap-6 md:grid-cols-1 md:gap-8">
      <Header
        title={report.title}
        actions={
          <Button asChild>
            <Link href={`./${params.id}/update/edit`}>Update</Link>
          </Button>
        }
      />
      <div className="col-span-full flex flex-col gap-6">
        <Summary report={report} monitors={monitors} />
        <Separator />
        {report.statusReportUpdates.length > 0 ? (
          <Events statusReportUpdates={report.statusReportUpdates} editable />
        ) : (
          <EmptyState id={params.id} />
        )}
      </div>
    </div>
  );
}
