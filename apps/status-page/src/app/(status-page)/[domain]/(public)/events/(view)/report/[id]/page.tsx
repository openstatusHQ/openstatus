"use client";

import { ButtonBack } from "@/components/button/button-back";
import { ButtonCopyLink } from "@/components/button/button-copy-link";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventAside,
  StatusEventContent,
  StatusEventDate,
  StatusEventTimelineReport,
  StatusEventTitle,
  StatusEventTitleCheck,
} from "@/components/status-page/status-events";
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
          <StatusEventDate date={firstUpdate.date} />
        </StatusEventAside>
        <StatusEventContent hoverable={false}>
          <StatusEventTitle className="inline-flex gap-1">
            {report.title}
            {isReportResolvedOnly ? <StatusEventTitleCheck /> : null}
          </StatusEventTitle>
          {report.monitorsToStatusReports.length > 0 ? (
            <StatusEventAffected>
              {report.monitorsToStatusReports.map((affected) => (
                <StatusEventAffectedBadge key={affected.monitor.id}>
                  {affected.monitor.name}
                </StatusEventAffectedBadge>
              ))}
            </StatusEventAffected>
          ) : null}
          <StatusEventTimelineReport updates={report.statusReportUpdates} />
        </StatusEventContent>
      </StatusEvent>
    </div>
  );
}
