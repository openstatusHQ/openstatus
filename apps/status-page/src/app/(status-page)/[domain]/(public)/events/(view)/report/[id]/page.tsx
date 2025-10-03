"use client";

import { formatDate } from "@/lib/formatter";

import { ButtonBack } from "@/components/button/button-back";
import { ButtonCopyLink } from "@/components/button/button-copy-link";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAside,
  StatusEventContent,
  StatusEventTimelineReport,
  StatusEventTitle,
  StatusEventTitleCheck,
} from "@/components/status-page/status-events";
import { Badge } from "@/components/ui/badge";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const trpc = useTRPC();
  const { id, domain } = useParams<{ id: string; domain: string }>();
  const { data: report } = useQuery(
    trpc.statusPage.getReport.queryOptions({ id: Number(id), slug: domain }),
  );

  if (!report) return null;

  const updates = report.statusReportUpdates.sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const firstUpdate = updates[updates.length - 1];
  const lastUpdate = updates[0];

  // HACKY: LEGACY: only resolved via report and not via report update
  const isReportResolvedOnly =
    report.status === "resolved" && lastUpdate.status !== "resolved";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
        <ButtonBack href="../" />
        <ButtonCopyLink />
      </div>
      <StatusEvent>
        <StatusEventAside>
          <span className="font-medium text-foreground/80">
            {formatDate(firstUpdate.date, { month: "short" })}
          </span>
        </StatusEventAside>
        <StatusEventContent hoverable={false}>
          <StatusEventTitle className="inline-flex gap-1">
            {report.title}
            {isReportResolvedOnly ? <StatusEventTitleCheck /> : null}
          </StatusEventTitle>
          {report.monitorsToStatusReports.length > 0 ? (
            <StatusEventAffected className="flex flex-wrap gap-1">
              {report.monitorsToStatusReports.map((affected) => (
                <Badge
                  key={affected.monitor.id}
                  variant="outline"
                  className="text-[10px]"
                >
                  {affected.monitor.name}
                </Badge>
              ))}
            </StatusEventAffected>
          ) : null}
          <StatusEventTimelineReport updates={report.statusReportUpdates} />
        </StatusEventContent>
      </StatusEvent>
    </div>
  );
}
