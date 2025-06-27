"use client";

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
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: statusReports, refetch } = useQuery(
    trpc.statusReport.list.queryOptions({ pageId: parseInt(id) })
  );
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const createStatusReportMutation = useMutation(
    trpc.statusReport.create.mutationOptions({
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    })
  );

  if (!statusReports || !monitors) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>OpenStatus Status</SectionTitle>
            <SectionDescription>
              See our uptime history and status reports.
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetStatusReport
              monitors={monitors}
              onSubmit={async (values) => {
                // NOTE: for type safety, we need to check if the values have a date property
                // because of the union type
                if ("date" in values) {
                  await createStatusReportMutation.mutateAsync({
                    title: values.title,
                    status: values.status,
                    pageId: parseInt(id),
                    monitors: values.monitors,
                    date: values.date,
                    message: values.message,
                  });
                }
              }}
            >
              <Button data-section="action" size="sm" variant="ghost">
                <Plus />
                Create Status Report
              </Button>
            </FormSheetStatusReport>
          </div>
        </SectionHeaderRow>
        <DataTable
          columns={columns}
          data={statusReports}
          rowComponent={({ row }) => (
            <UpdatesDataTable
              updates={row.original.updates}
              reportId={row.original.id}
            />
          )}
        />
      </Section>
    </SectionGroup>
  );
}
