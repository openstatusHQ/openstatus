import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Events } from "@/components/status-update/events";
import { api } from "@/trpc/server";
import { Header } from "./_components/header";

export default async function OverviewPage({
  params,
}: {
  params: { workspaceSlug: string; reportId: string };
}) {
  const report = await api.statusReport.getStatusReportById.query({
    id: Number.parseInt(params.reportId),
  });

  if (!report) return notFound();

  return (
    <>
      <Header report={report} />
      {report.statusReportUpdates.length > 0 ? (
        <Events statusReportUpdates={report.statusReportUpdates} editable />
      ) : (
        <EmptyState
          icon="megaphone"
          title="No status report updates"
          description="Create your first update"
        />
      )}
    </>
  );
}
