"use client";

import { currentImpactsFromUpdates } from "@openstatus/db/src/schema/page_components/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { format } from "date-fns";
import { toast } from "sonner";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailInput,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailSection,
  DetailSectionTitle,
  DetailTitle,
  DetailTitleRow,
} from "@/components/content/detail";
import { SectionGroup } from "@/components/content/section";
import { Timeline } from "@/components/content/timeline";
import { StatusReportActions } from "@/components/status-reports/status-report-actions";
import { AffectedComponents } from "@/components/status-reports/status-report-components";
import { StatusReportComposer } from "@/components/status-reports/status-report-composer";
import { Notifications } from "@/components/status-reports/status-report-notifications";
import {
  StatusReportProperties,
  reportStartedAt,
} from "@/components/status-reports/status-report-properties";
import { StatusReportTimelineItem } from "@/components/status-reports/status-report-timeline";
import { useInvalidateStatusReport } from "@/components/status-reports/use-invalidate-status-report";
import { getPageUrl } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";

function MetaDate({ date }: { date: Date }) {
  return (
    <HoverCardTimestamp date={date} side="bottom">
      <time dateTime={date.toISOString()} className="text-foreground font-mono">
        {format(date, "LLL dd, HH:mm")}
      </time>
    </HoverCardTimestamp>
  );
}

export function Client({ id }: { id: number }) {
  const trpc = useTRPC();
  const { data: report } = useQuery(trpc.statusReport.get.queryOptions({ id }));
  const { data: page } = useQuery(
    trpc.page.get.queryOptions(
      { id: report?.pageId ?? 0 },
      { enabled: report?.pageId != null },
    ),
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  const invalidate = useInvalidateStatusReport(id);
  const update = useMutation(
    trpc.statusReport.updateStatus.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  if (!report) return null;

  const publicUrl = `${getPageUrl(report.page)}/events/report/${report.id}`;
  const canNotify = workspace?.limits["status-subscribers"] === true;
  const updates = [...report.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
  );
  const latest = updates[0];
  const currentImpacts = currentImpactsFromUpdates(report.updates);

  return (
    <SectionGroup>
      <DetailHeader>
        <DetailTitleRow>
          <DetailTitle>
            <DetailInput
              aria-label="Title"
              required
              maxLength={256}
              disabled={update.isPending}
              value={report.title}
              onCommit={(title) => update.mutate({ id: report.id, title })}
            />
          </DetailTitle>
          <DetailActions>
            <StatusReportActions report={report} />
          </DetailActions>
        </DetailTitleRow>
        <DetailMeta>
          <DetailMetaItem>
            Opened <MetaDate date={reportStartedAt(report)} />
          </DetailMetaItem>
          <DetailMetaItem>
            {updates.length} {updates.length === 1 ? "update" : "updates"}
          </DetailMetaItem>
          {latest ? (
            <DetailMetaItem>
              Last update <MetaDate date={latest.date} />
            </DetailMetaItem>
          ) : null}
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <Timeline>
            <StatusReportComposer
              report={report}
              pageComponents={page?.pageComponents ?? []}
              canNotify={canNotify}
            />
            {updates.map((update, i) => (
              <StatusReportTimelineItem
                key={update.id}
                report={report}
                update={update}
                index={updates.length - i}
              />
            ))}
          </Timeline>
        </DetailMain>
        <DetailAside>
          <DetailSection>
            <DetailSectionTitle>Properties</DetailSectionTitle>
            <StatusReportProperties report={report} />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Affected components</DetailSectionTitle>
            <AffectedComponents
              components={report.pageComponents}
              impacts={currentImpacts}
              note="Change impact per component in the composer."
            />
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Notifications</DetailSectionTitle>
            <Notifications
              pageId={report.pageId ?? 0}
              publicUrl={publicUrl}
              description="Customers can read this report on your status page."
            />
          </DetailSection>
        </DetailAside>
      </DetailContent>
    </SectionGroup>
  );
}
