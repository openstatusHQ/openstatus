"use client";

import { Impact } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useParams } from "next/navigation";

import { Link } from "@/components/common/link";
import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventList,
  EventListGroup,
  EventListGroupTitle,
  EventListGroups,
  EventListMore,
} from "@/components/content/event-list";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { StatusReportRow } from "@/components/status-reports/status-report-row";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { groupByMonth } from "@/data/event-list.client";
import { reportStartedAt } from "@/data/status-reports.client";
import { useShowMore } from "@/hooks/use-show-more";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: page } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: statusReports, refetch } = useQuery(
    trpc.statusReport.list.queryOptions({ pageId: Number.parseInt(id) }),
  );
  const sendStatusReportUpdateMutation = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );
  const createStatusReportMutation = useMutation(
    trpc.statusReport.create.mutationOptions({
      onSuccess: (statusReport) => {
        if (statusReport.notifySubscribers) {
          sendStatusReportUpdateMutation.mutate({
            id: statusReport.initialUpdateId,
          });
        }
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  const sorted = [...(statusReports ?? [])].sort(
    (a, b) => reportStartedAt(b).getTime() - reportStartedAt(a).getTime(),
  );
  const open = sorted.filter((report) => report.status !== "resolved");
  const resolved = useShowMore(
    sorted.filter((report) => report.status === "resolved"),
  );
  const months = groupByMonth(resolved.visible, reportStartedAt);

  if (!statusReports || !page) return null;

  const hasUnresolvedIssue = open.length > 0;

  return (
    <SectionGroup>
      <NoteDismissible cookieKey="note_status_reports_component_impacts">
        <Impact />
        Status reports now support per-component impacts.
        <NoteButton variant="default" asChild>
          <NextLink
            href="https://www.openstatus.dev/changelog/status-page-components-impact"
            target="_blank"
          >
            Learn more
          </NextLink>
        </NoteButton>
      </NoteDismissible>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{page.title}</SectionTitle>
            <SectionDescription>
              List of all status reports. Looking for{" "}
              <Link href={`/status-pages/${id}/maintenances`}>
                maintenances
              </Link>
              ?
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetStatusReport
              warning={
                hasUnresolvedIssue ? (
                  <>
                    An unresolved report already exists. Consider adding a{" "}
                    <span className="font-semibold">status report update</span>{" "}
                    instead.
                  </>
                ) : undefined
              }
              items={toCheckboxTreeItems(
                page.pageComponents,
                page.pageComponentGroups,
              )}
              onSubmit={async (values) => {
                // NOTE: for type safety, we need to check if the values have a date property
                // because of the union type
                if ("date" in values) {
                  // every selected component gets an impact row — fresh
                  // reports are never legacy; fallback must match the
                  // picker's defaultImpact
                  const componentImpacts = values.pageComponents.map(
                    (pageComponentId) => ({
                      pageComponentId,
                      impact:
                        values.componentImpacts?.find(
                          (ci) => ci.pageComponentId === pageComponentId,
                        )?.impact ?? ("degraded_performance" as const),
                    }),
                  );
                  await createStatusReportMutation.mutateAsync({
                    title: values.title,
                    status: values.status,
                    pageId: Number.parseInt(id),
                    pageComponents: values.pageComponents,
                    componentImpacts,
                    date: values.date,
                    message: values.message,
                    notifySubscribers: values.notifySubscribers,
                  });
                }
              }}
            >
              <Button data-section="action" size="sm">
                Create Status Report
              </Button>
            </FormSheetStatusReport>
          </div>
        </SectionHeaderRow>
        {statusReports.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No status reports</EmptyStateTitle>
            <EmptyStateDescription>
              Create a status report to tell your users about an issue and keep
              them posted until it is resolved.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <EventListGroups>
            {open.length > 0 ? (
              <EventListGroup aria-labelledby="reports-open">
                <EventListGroupTitle id="reports-open">
                  Ongoing
                </EventListGroupTitle>
                <EventList>
                  {open.map((report) => (
                    <StatusReportRow key={report.id} report={report} />
                  ))}
                </EventList>
              </EventListGroup>
            ) : null}
            {months.map((month) => (
              <EventListGroup
                key={month.key}
                aria-labelledby={`reports-${month.key}`}
              >
                <EventListGroupTitle id={`reports-${month.key}`}>
                  {month.label}
                </EventListGroupTitle>
                <EventList>
                  {month.items.map((report) => (
                    <StatusReportRow key={report.id} report={report} />
                  ))}
                </EventList>
              </EventListGroup>
            ))}
            {resolved.hasMore ? (
              <EventListMore onClick={resolved.showMore} />
            ) : null}
          </EventListGroups>
        )}
      </Section>
    </SectionGroup>
  );
}
