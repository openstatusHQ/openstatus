import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import {
  StatusReportDescription,
  StatusReportUpdates,
} from "@/components/status-page/status-report";
import { api } from "@/trpc/server";
import { CopyLinkButton } from "./_components/copy-link-button";

export default async function IncidentPage({
  params,
}: {
  params: { domain: string; id: string };
}) {
  const report = await api.statusReport.getPublicStatusReportById.query({
    slug: params.domain,
    id: Number(params.id),
  });

  if (!report) return notFound();

  const affectedMonitors = report.monitorsToStatusReports.map(
    ({ monitor }) => monitor
  );

  return (
    <div className="grid gap-8 text-left">
      <Header
        title={report.title}
        description={
          <StatusReportDescription
            report={report}
            monitors={affectedMonitors}
          />
        }
        actions={<CopyLinkButton />}
      />
      <StatusReportUpdates report={report} />
    </div>
  );
}
