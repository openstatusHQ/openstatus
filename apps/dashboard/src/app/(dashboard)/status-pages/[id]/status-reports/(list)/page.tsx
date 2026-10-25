"use client";

import { ExternalLink, Impact, Success } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Link } from "@/components/common/link";
import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  Activity,
  ActivityHeader,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import {
  ActivityCalendar,
  ActivityCalendarCell,
  ActivityCalendarGrid,
  ActivityCalendarLegend,
  ActivityCalendarLegendItem,
} from "@/components/content/activity-calendar";
import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventGroup,
  EventGroupCount,
  EventGroupHeader,
  EventGroupTitle,
} from "@/components/content/event-group";
import { EventList, EventListMore } from "@/components/content/event-list";
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
import {
  activityDayLabel,
  activityRange,
  groupByDay,
  strongestMark,
} from "@/data/activity.client";
import { getPageUrl } from "@/data/status-pages.client";
import {
  reportActivity,
  reportSpan,
  reportStartedAt,
} from "@/data/status-reports.client";
import { usePaged } from "@/hooks/use-paged";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
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

  const byStart = <T extends Parameters<typeof reportStartedAt>[0]>(
    a: T,
    b: T,
  ) => reportStartedAt(b).getTime() - reportStartedAt(a).getTime();
  const ongoing = (statusReports ?? [])
    .filter((report) => report.status !== "resolved")
    .sort(byStart);
  const resolved = (statusReports ?? [])
    .filter((report) => report.status === "resolved")
    .sort(byStart);
  const paged = usePaged(resolved);

  if (!statusReports || !page) return null;

  const items = toCheckboxTreeItems(
    page.pageComponents,
    page.pageComponentGroups,
  );
  const createStatusReport = async (
    values: Parameters<
      React.ComponentProps<typeof FormSheetStatusReport>["onSubmit"]
    >[0],
  ) => {
    // NOTE: for type safety, we need to check if the values have a date property
    // because of the union type
    if ("date" in values) {
      // every selected component gets an impact row — fresh
      // reports are never legacy; fallback must match the
      // picker's defaultImpact
      const componentImpacts = values.pageComponents.map((pageComponentId) => ({
        pageComponentId,
        impact:
          values.componentImpacts?.find(
            (ci) => ci.pageComponentId === pageComponentId,
          )?.impact ?? ("degraded_performance" as const),
      }));
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
  };

  const now = new Date();
  const range = activityRange(now);
  const days = groupByDay(range, statusReports, reportSpan, now).map(
    ({ date, items }) => ({
      date,
      ...strongestMark(items.map(reportActivity)),
      label: activityDayLabel(
        date,
        items.map((report) => report.title),
        "reports",
      ),
      links: items.map((report) => ({
        href: `/status-pages/${report.pageId}/status-reports/${report.id}`,
        title: report.title,
      })),
    }),
  );

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
              What you have told your users, and when. Looking for{" "}
              <Link href={`/status-pages/${id}/maintenances`}>
                maintenances
              </Link>
              ?
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetStatusReport
              open={openCreate}
              onOpenChange={setOpenCreate}
              warning={
                ongoing.length > 0 ? (
                  <>
                    An unresolved report already exists. Consider adding a{" "}
                    <span className="font-semibold">status report update</span>{" "}
                    instead.
                  </>
                ) : undefined
              }
              items={items}
              onSubmit={createStatusReport}
            >
              <Button data-section="action" size="sm">
                Create status report
              </Button>
            </FormSheetStatusReport>
          </div>
        </SectionHeaderRow>
        {statusReports.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateMedia variant="success">
              <Success />
            </EmptyStateMedia>
            <EmptyStateTitle>Nothing to report</EmptyStateTitle>
            <EmptyStateDescription>
              Nothing has been published on this page. When something breaks,
              post a report here to keep visitors informed, and notify your
              subscribers by email.
            </EmptyStateDescription>
            <EmptyStateActions>
              <Button size="sm" onClick={() => setOpenCreate(true)}>
                Create a report
              </Button>
              <Button size="sm" variant="outline" asChild>
                <NextLink
                  href={getPageUrl(page)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink />
                  Open public page
                </NextLink>
              </Button>
            </EmptyStateActions>
          </EmptyStateContainer>
        ) : (
          <>
            <Activity>
              <ActivityHeader>
                <ActivityTitle>Activity</ActivityTitle>
                <ActivityPeriod>Last 12 months</ActivityPeriod>
              </ActivityHeader>
              <ActivityCalendar>
                <ActivityCalendarGrid days={days} today={now} />
                <ActivityCalendarLegend>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell level={1} />
                    Untriaged
                  </ActivityCalendarLegendItem>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell variant="warning" level={1} />
                    Degraded
                  </ActivityCalendarLegendItem>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell variant="warning" level={2} />
                    Partial outage
                  </ActivityCalendarLegendItem>
                  <ActivityCalendarLegendItem>
                    <ActivityCalendarCell variant="destructive" level={3} />
                    Major outage
                  </ActivityCalendarLegendItem>
                </ActivityCalendarLegend>
              </ActivityCalendar>
            </Activity>
            <div className="flex flex-col gap-6">
              {ongoing.length > 0 ? (
                <EventGroup>
                  <EventGroupHeader>
                    <EventGroupTitle>
                      Ongoing
                      <EventGroupCount>{ongoing.length}</EventGroupCount>
                    </EventGroupTitle>
                  </EventGroupHeader>
                  <EventList>
                    {ongoing.map((report) => (
                      <StatusReportRow key={report.id} report={report} />
                    ))}
                  </EventList>
                </EventGroup>
              ) : null}
              {resolved.length > 0 ? (
                <EventGroup>
                  <EventGroupHeader>
                    <EventGroupTitle>
                      Resolved
                      <EventGroupCount>{resolved.length}</EventGroupCount>
                    </EventGroupTitle>
                  </EventGroupHeader>
                  <EventList>
                    {paged.visible.map((report) => (
                      <StatusReportRow key={report.id} report={report} />
                    ))}
                    {paged.hasMore ? (
                      <EventListMore onClick={paged.showMore}>
                        Show older
                      </EventListMore>
                    ) : null}
                  </EventList>
                </EventGroup>
              ) : null}
            </div>
          </>
        )}
      </Section>
    </SectionGroup>
  );
}
