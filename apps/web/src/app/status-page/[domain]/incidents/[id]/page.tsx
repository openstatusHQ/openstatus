import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, Separator } from "@openstatus/ui";

import { Events } from "@/components/status-update/events";
import { Summary } from "@/components/status-update/summary";
import { api } from "@/trpc/server";
import { setPrefixUrl } from "../../utils";
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
    ({ monitor }) => monitor,
  );

  return (
    <div className="grid gap-4 text-left">
      <div>
        <Button variant="link" size="sm" className="px-0" asChild>
          <Link href={setPrefixUrl("/", params)}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <h3 className="text-xl font-semibold">{report.title}</h3>
        <CopyLinkButton />
      </div>
      <Summary report={report} monitors={affectedMonitors} />
      <Separator />
      <Events statusReportUpdates={report.statusReportUpdates} />
    </div>
  );
}
