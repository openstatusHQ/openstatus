import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import { StatusReportUpdates } from "@/components/status-page/status-report";
import { api } from "@/trpc/server";
import { CopyLinkButton } from "./_components/copy-link-button";
import { Badge } from "@openstatus/ui";
import { DateTimeTooltip } from "@/components/status-page/datetime-tooltip";

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

  const firstUpdate =
    report.statusReportUpdates[report.statusReportUpdates.length - 1] ||
    undefined;

  return (
    <div className="grid gap-8 text-left">
      <Header
        title={report.title}
        description={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-sm tracking-wide">
              Started at <DateTimeTooltip date={firstUpdate?.date} />
            </p>
            {affectedMonitors.length > 0 ? (
              <>
                <span className="text-muted-foreground/50 text-xs">•</span>
                <div className="flex flex-wrap gap-2">
                  {affectedMonitors.map((monitor) => (
                    <Badge key={monitor.id} variant="secondary">
                      {monitor.name}
                    </Badge>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        }
        actions={<CopyLinkButton />}
      />
      <StatusReportUpdates updates={report.statusReportUpdates} />
    </div>
  );
}
