"use client";

import {
  EmptyStateContainer,
  EmptyStateDescription,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormSheetWithDirtyProtection } from "@/components/forms/form-sheet";
import type { FormValues } from "@/components/forms/status-report-update/form";
import { FormStatusReportUpdateCard } from "@/components/forms/status-report-update/form-status-report";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

export default function Page() {
  const { reportId } = useParams<{ id: string; reportId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: statusReport, refetch } = useQuery(
    trpc.statusReport.get.queryOptions({ id: Number.parseInt(reportId) }),
  );

  const sendStatusReportUpdateMutation = useMutation(
    trpc.emailRouter.sendStatusReport.mutationOptions(),
  );

  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: (update) => {
        if (update?.notifySubscribers) {
          sendStatusReportUpdateMutation.mutateAsync({ id: update.id });
        }
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  const updateStatusReportUpdateMutation = useMutation(
    trpc.statusReport.updateStatusReportUpdate.mutationOptions({
      onSuccess: () => {
        refetch();
      },
    }),
  );

  if (!statusReport) return null;

  const updates = [...statusReport.updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  const affected = statusReport.pageComponents
    .map((component) => component.name)
    .join(", ");

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{statusReport.title}</SectionTitle>
            <SectionDescription>
              Manage updates for this status report. Affects{" "}
              <span className="text-foreground">
                {affected ? affected : "zero"}
              </span>{" "}
              component(s).
            </SectionDescription>
          </SectionHeader>
        </SectionHeaderRow>

        <EmptyStateContainer className="my-8 border-dashed">
          <EmptyStateDescription>Status Page Report</EmptyStateDescription>
          <FormSheetStatusReportUpdate
            onSubmit={async (values: FormValues) => {
              await createStatusReportUpdateMutation.mutateAsync({
                statusReportId: statusReport.id,
                message: values.message,
                status: values.status,
                date: values.date,
                notifySubscribers: values.notifySubscribers,
              });
            }}
          >
            <Button size="sm">
              <Plus />
              Create Status Update
            </Button>
          </FormSheetStatusReportUpdate>
        </EmptyStateContainer>

        <FormCardGroup>
          {updates.map((update, index) => (
            <FormSheetWithDirtyProtection key={update.id}>
              <FormStatusReportUpdateCard
                id={`update-form-${update.id}`}
                index={index}
                update={update}
                defaultValues={{
                  status: update.status,
                  message: update.message,
                  date: update.date,
                }}
                onSubmit={async (values: FormValues) => {
                  await updateStatusReportUpdateMutation.mutateAsync({
                    id: update.id,
                    statusReportId: statusReport.id,
                    message: values.message,
                    status: values.status,
                    date: values.date,
                  });
                }}
              />
            </FormSheetWithDirtyProtection>
          ))}
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
