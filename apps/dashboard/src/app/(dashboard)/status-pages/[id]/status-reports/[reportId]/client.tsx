"use client";

import { currentImpactsFromUpdates } from "@openstatus/db/src/schema/page_components/constants";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import {
  ComponentList,
  ComponentListActions,
  ComponentListEmpty,
  ComponentListImpact,
  ComponentListItem,
  ComponentListName,
} from "@/components/content/component-list";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailHeader,
  DetailInput,
  DetailMain,
  DetailMeta,
  DetailMetaItem,
  DetailMetaTime,
  DetailSection,
  DetailSectionTitle,
  DetailTitle,
  DetailTitleRow,
} from "@/components/content/detail";
import { SectionGroup } from "@/components/content/section";
import { Timeline } from "@/components/content/timeline";
import { Notifications } from "@/components/status-pages/notifications";
import { StatusReportActions } from "@/components/status-reports/status-report-actions";
import { StatusReportComposer } from "@/components/status-reports/status-report-composer";
import { StatusReportProperties } from "@/components/status-reports/status-report-properties";
import { StatusReportTimelineItem } from "@/components/status-reports/status-report-timeline";
import { useInvalidateStatusReport } from "@/components/status-reports/use-invalidate-status-report";
import { getPageUrl } from "@/data/status-pages.client";
import { impactDisplay } from "@/data/status-report-updates.client";
import { reportStartedAt } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

export function Client({ id, pageId }: { id: number; pageId: number }) {
  const trpc = useTRPC();
  const { data: report } = useQuery(trpc.statusReport.get.queryOptions({ id }));
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  const invalidate = useInvalidateStatusReport(id);
  const update = useMutation(
    trpc.statusReport.updateStatus.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        toast.error(errorMessage(error, "Failed to save"));
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
            <StatusReportActions report={report} publicUrl={publicUrl} />
          </DetailActions>
        </DetailTitleRow>
        <DetailMeta>
          <DetailMetaItem>
            Opened <DetailMetaTime date={reportStartedAt(report)} />
          </DetailMetaItem>
          <DetailMetaItem>
            {updates.length} {updates.length === 1 ? "update" : "updates"}
          </DetailMetaItem>
          {latest ? (
            <DetailMetaItem>
              Last update <DetailMetaTime date={latest.date} />
            </DetailMetaItem>
          ) : null}
        </DetailMeta>
      </DetailHeader>
      <DetailContent>
        <DetailMain>
          <Timeline>
            <StatusReportComposer
              report={report}
              currentImpacts={currentImpacts}
              pageComponents={page?.pageComponents ?? []}
              groups={page?.pageComponentGroups ?? []}
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
            {report.pageComponents.length ? (
              <ComponentList>
                {report.pageComponents.map((component) => {
                  const impact = impactDisplay(
                    currentImpacts.get(component.id),
                  );
                  return (
                    <ComponentListItem key={component.id}>
                      <StatusDot variant={impact.variant} />
                      <ComponentListName>{component.name}</ComponentListName>
                      <ComponentListActions>
                        <ComponentListImpact>
                          {impact.label}
                        </ComponentListImpact>
                      </ComponentListActions>
                    </ComponentListItem>
                  );
                })}
              </ComponentList>
            ) : (
              <ComponentListEmpty />
            )}
            <p className="text-muted-foreground text-sm">
              Change impact per component in the composer.
            </p>
          </DetailSection>
          <DetailSection>
            <DetailSectionTitle>Notifications</DetailSectionTitle>
            <Notifications
              pageId={pageId}
              publicUrl={publicUrl}
              description="Customers can read this report on your status page."
            />
          </DetailSection>
        </DetailAside>
      </DetailContent>
    </SectionGroup>
  );
}
