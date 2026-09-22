"use client";

import { Impact, Add } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useParams } from "next/navigation";

import { Link } from "@/components/common/link";
import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { DataTable as UpdatesDataTable } from "@/components/data-table/status-report-updates/data-table";
import { columns } from "@/components/data-table/status-reports/columns";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { DataTable } from "@/components/ui/data-table/data-table";
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
            id: statusReport.id,
          });
        }
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  if (!statusReports || !page) return null;

  const hasUnresolvedIssue = statusReports.some(
    (report) => report.status !== "resolved",
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
                <Add />
                Create Status Report
              </Button>
            </FormSheetStatusReport>
          </div>
        </SectionHeaderRow>
        <DataTable
          columns={columns}
          data={statusReports}
          onRowClick={(row) =>
            row.getCanExpand() ? row.toggleExpanded() : undefined
          }
          rowComponent={({ row }) => (
            <UpdatesDataTable
              updates={row.original.updates}
              reportId={row.original.id}
              components={row.original.pageComponents.map((c) => ({
                id: c.id,
                name: c.name,
              }))}
            />
          )}
        />
      </Section>
    </SectionGroup>
  );
}
